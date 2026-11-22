package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type photoVisuals struct {
	HasColor    bool
	BgHex       string
	AccentHex   string
	LightHex    string
	Warmth      string // "warm" | "cool" | "neutral"
	Brightness  string // "dark" | "balanced" | "bright"
	Description string
}

type aiRecipeResponse struct {
	FolderTitle         string    `json:"folderTitle"`
	Mood                string    `json:"mood"`
	MoodLabel           string    `json:"moodLabel"`
	ArtStyle            string    `json:"artStyle"`
	TypographyVariant   string    `json:"typographyVariant"`
	Palette             [3]string `json:"palette"`
	GrainIntensity      float64   `json:"grainIntensity"`
	MotionSpeed         float64   `json:"motionSpeed"`
	AtmosphereNote      string    `json:"atmosphereNote"`
	CuratorSummary      string    `json:"curatorSummary"`
	PersonalizationNote string    `json:"personalizationNote"`
}

func generateDayRecipe(
	ctx context.Context,
	user User,
	recentDays []Day,
	text string,
	track TrackInfo,
	localPhotoPaths []string,
	photoCount int,
	allowCloudAI bool,
) (string, StyleRecipe) {
	visuals := extractPhotoVisuals(localPhotoPaths)
	fallbackTitle, fallbackStyle := fallbackAnalyzeDay(user, text, track, visuals, photoCount)

	apiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if apiKey == "" || !allowCloudAI {
		return fallbackTitle, fallbackStyle
	}

	aiCtx, cancel := context.WithTimeout(ctx, 18*time.Second)
	defer cancel()

	result, err := callGeminiRecipe(aiCtx, apiKey, user, recentDays, text, track, visuals, photoCount)
	if err != nil {
		log.Printf("Gemini generation fallback: %v", err)
		return fallbackTitle, fallbackStyle
	}

	return mergeAndValidateRecipe(result, fallbackTitle, fallbackStyle, track, user.Bio != "")
}

func callGeminiRecipe(
	ctx context.Context,
	apiKey string,
	user User,
	recentDays []Day,
	text string,
	track TrackInfo,
	visuals photoVisuals,
	photoCount int,
) (aiRecipeResponse, error) {
	model := strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	if model == "" {
		model = "gemini-3.8-flash"
	}

	recentSummary := "Пока нет прошлых записей."
	if len(recentDays) > 0 {
		parts := make([]string, 0, len(recentDays))
		for _, d := range recentDays {
			parts = append(parts, fmt.Sprintf("- «%s» (стиль: %s, настроение: %s)", d.FolderTitle, d.Style.ArtStyle, d.Style.Mood))
		}
		recentSummary = strings.Join(parts, "\n")
	}

	bioText := strings.TrimSpace(user.Bio)
	if bioText == "" {
		bioText = "Не указано."
	}

	photoInfo := fmt.Sprintf("Количество фотографий в альбоме: %d.", photoCount)
	if visuals.HasColor {
		photoInfo += fmt.Sprintf(
			" Извлечённые из фото оттенки: фон %s, акцент %s, светлый тон %s (%s).",
			visuals.BgHex,
			visuals.AccentHex,
			visuals.LightHex,
			visuals.Description,
		)
	}

	prompt := fmt.Sprintf(`Ты — арт-директор личного цифрового дневника KeepMemory, который превращает день человека (текст, альбом фотографий и песню) в атмосферное воспоминание внутри единой визуальной системы.

Профиль владельца дневника:
- Имя: %s
- Интересы и описание профиля: %s
- Последние записи в дневнике (для цельности стиля и избегания повторов):
%s

Данные сегодняшнего дня:
- Текст записи: %s
- %s
- Песня дня: «%s» — %s (жанр: %s, энергия трека: %.2f из 1.00)

Правила визуальной системы KeepMemory:
1. Выбери ровно один artStyle из четырёх:
   - "analog_film": камерные вечера, прогулки, тепло, ностальгия, живое общение, джаз/инди/акустика (референс: плёнка 35мм).
   - "minimal_editorial": ясность, фокус, утренний свет, собранный ритм, минимализм, лоу-фай (референс: японская и швейцарская графика).
   - "dreamy_aura": дождь, закаты, тишина, усталость, созерцание, эмбиент/неоклассика (референс: свет и дымка Клода Моне).
   - "kinetic_zine": драйв, дедлайны, спорт, ночной город, сильное напряжение, электроника/хип-хоп/рок (референс: геометрия и динамика Кандинского).
2. Выбери typographyVariant: "serif_editorial" (тёплый, личный, созерцательный тон) или "mono_archive" (собранный, ритмичный, графичный тон).
3. Выбери mood ровно из пяти категорий: "happy", "warm", "calm", "energetic", "sad".
4. Палитра palette — ровно 3 HEX-цвета [глубокий тёмный фон (яркость < 18%%), выразительный акцент/свет, светлый читаемый цвет текста (яркость > 84%%)]. Опирайся на реальные оттенки фото и атмосферу дня, не своди к примитиву «грустно = синий».
5. motionSpeed: от 0.35 до 1.85, заметно зависит от энергии песни (спокойные треки 0.4–0.7, средние 0.8–1.15, энергичные 1.25–1.8).
6. grainIntensity: от 0.15 до 0.72.
7. folderTitle: короткое атмосферное название папки на русском языке длиной строго от 3 до 7 слов, без кавычек и точки в конце.
8. moodLabel: естественная метка настроения на русском (2–3 слова, например «Тёплый уют», «Ночной фокус», «Тихий дождь»), не медицинский и не психологический диагноз.
9. atmosphereNote: 1 живое, образное предложение (до 135 символов) для подписи на открытке — уникальное именно для этого дня, без шаблонов и клише.
10. curatorSummary: 2 конкретных предложения на русском, объясняющих, как текст, свет фото, песня и альбом сложились в этот образ (без терминов ИИ и без психологических диагнозов).
11. personalizationNote: если в профиле указаны интересы/описание, напиши 1 короткое предложение на русском, как особенности профиля повлияли на выбор подачи; если описание профиля пустое, верни пустую строку "".`,
		user.DisplayName,
		bioText,
		recentSummary,
		text,
		photoInfo,
		track.Title,
		track.Artist,
		track.Genre,
		track.Energy,
	)

	requestPayload := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]string{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":      0.7,
			"responseMimeType": "application/json",
			"responseSchema": map[string]interface{}{
				"type": "OBJECT",
				"properties": map[string]interface{}{
					"folderTitle":         map[string]string{"type": "STRING"},
					"mood":                map[string]interface{}{"type": "STRING", "enum": []string{"happy", "warm", "calm", "energetic", "sad"}},
					"moodLabel":           map[string]string{"type": "STRING"},
					"artStyle":            map[string]interface{}{"type": "STRING", "enum": []string{"analog_film", "minimal_editorial", "dreamy_aura", "kinetic_zine"}},
					"typographyVariant":   map[string]interface{}{"type": "STRING", "enum": []string{"serif_editorial", "mono_archive"}},
					"palette":             map[string]interface{}{"type": "ARRAY", "items": map[string]string{"type": "STRING"}},
					"grainIntensity":      map[string]string{"type": "NUMBER"},
					"motionSpeed":         map[string]string{"type": "NUMBER"},
					"atmosphereNote":      map[string]string{"type": "STRING"},
					"curatorSummary":      map[string]string{"type": "STRING"},
					"personalizationNote": map[string]string{"type": "STRING"},
				},
				"required": []string{
					"folderTitle",
					"mood",
					"moodLabel",
					"artStyle",
					"typographyVariant",
					"palette",
					"grainIntensity",
					"motionSpeed",
					"atmosphereNote",
					"curatorSummary",
					"personalizationNote",
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(requestPayload)
	if err != nil {
		return aiRecipeResponse{}, err
	}

	endpoint := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent",
		model,
	)
	client := &http.Client{Timeout: 18 * time.Second}
	resp, err := doWithRetry(ctx, client, func(requestCtx context.Context) (*http.Request, error) {
		req, err := http.NewRequestWithContext(requestCtx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-goog-api-key", apiKey)
		return req, nil
	})
	if err != nil {
		return aiRecipeResponse{}, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return aiRecipeResponse{}, err
	}

	if resp.StatusCode != http.StatusOK {
		snippet := []rune(strings.TrimSpace(string(respBytes)))
		if len(snippet) > 300 {
			snippet = append(snippet[:300], []rune("...")...)
		}
		log.Printf("Gemini API HTTP %d: %s", resp.StatusCode, string(snippet))
		return aiRecipeResponse{}, upstreamStatusError{StatusCode: resp.StatusCode}
	}

	var envelope struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(respBytes, &envelope); err != nil {
		return aiRecipeResponse{}, err
	}
	if len(envelope.Candidates) == 0 || len(envelope.Candidates[0].Content.Parts) == 0 {
		return aiRecipeResponse{}, fmt.Errorf("empty gemini response")
	}

	rawJSON := strings.TrimSpace(envelope.Candidates[0].Content.Parts[0].Text)
	rawJSON = strings.TrimPrefix(rawJSON, "```json")
	rawJSON = strings.TrimPrefix(rawJSON, "```")
	rawJSON = strings.TrimSuffix(rawJSON, "```")
	rawJSON = strings.TrimSpace(rawJSON)

	var parsed aiRecipeResponse
	if err := json.Unmarshal([]byte(rawJSON), &parsed); err != nil {
		return aiRecipeResponse{}, fmt.Errorf("parse gemini JSON: %w", err)
	}

	return parsed, nil
}

func mergeAndValidateRecipe(
	ai aiRecipeResponse,
	fallbackTitle string,
	fallbackStyle StyleRecipe,
	track TrackInfo,
	hasBio bool,
) (string, StyleRecipe) {
	title := strings.Trim(strings.TrimSpace(ai.FolderTitle), "«»\"'. ")
	if !validFolderTitle(title) {
		title = fallbackTitle
	}
	if runes := []rune(title); len(runes) > 64 {
		title = fallbackTitle
	}

	style := fallbackStyle
	style.AIGenerated = true

	switch ai.ArtStyle {
	case "analog_film", "minimal_editorial", "dreamy_aura", "kinetic_zine":
		style.ArtStyle = ai.ArtStyle
	}

	switch ai.TypographyVariant {
	case "serif_editorial", "mono_archive":
		style.TypographyVariant = ai.TypographyVariant
	}

	switch ai.Mood {
	case "happy", "warm", "calm", "energetic", "sad":
		style.Mood = ai.Mood
	}

	if hasReadablePaletteContrast(ai.Palette) {
		style.Palette = ai.Palette
	}

	if ai.GrainIntensity > 0 {
		style.GrainIntensity = clampFloat(ai.GrainIntensity, 0.12, 0.78)
	}

	if ai.MotionSpeed > 0 {
		// Удерживаем заметную связь с энергией трека
		blendedSpeed := ai.MotionSpeed*0.7 + (0.4+track.Energy*1.2)*0.3
		style.MotionSpeed = math.Round(clampFloat(blendedSpeed, 0.35, 1.85)*100) / 100
	}

	if note := strings.TrimSpace(ai.AtmosphereNote); utf8.RuneCountInString(note) >= 12 {
		style.AtmosphereNote = note
	}
	if label := strings.TrimSpace(ai.MoodLabel); utf8.RuneCountInString(label) >= 3 {
		style.MoodLabel = label
	}
	if summary := strings.TrimSpace(ai.CuratorSummary); utf8.RuneCountInString(summary) >= 20 {
		style.CuratorSummary = summary
	}
	if hasBio {
		style.PersonalizationNote = strings.TrimSpace(ai.PersonalizationNote)
	} else {
		style.PersonalizationNote = ""
	}

	return title, style
}

func validFolderTitle(title string) bool {
	wordCount := len(strings.Fields(title))
	return wordCount >= 3 && wordCount <= 7 && utf8.RuneCountInString(title) <= 64
}

func hasReadablePaletteContrast(palette [3]string) bool {
	if !isValidHex(palette[0]) || !isValidHex(palette[1]) || !isValidHex(palette[2]) {
		return false
	}
	bgLum := hexLuminance(palette[0])
	textLum := hexLuminance(palette[2])
	return bgLum <= 0.25 && textLum >= 0.70
}

func hexLuminance(hex string) float64 {
	r, _ := strconv.ParseUint(hex[1:3], 16, 8)
	g, _ := strconv.ParseUint(hex[3:5], 16, 8)
	b, _ := strconv.ParseUint(hex[5:7], 16, 8)
	return (0.2126*float64(r) + 0.7152*float64(g) + 0.0722*float64(b)) / 255.0
}

func fallbackAnalyzeDay(
	user User,
	text string,
	track TrackInfo,
	visuals photoVisuals,
	photoCount int,
) (string, StyleRecipe) {
	lowerText := strings.ToLower(text)
	lowerBio := strings.ToLower(user.Bio)
	combined := lowerText + " " + strings.ToLower(track.Title+" "+track.Genre)
	energy := clampFloat(track.Energy, 0.15, 1.0)
	motionSpeed := math.Round((0.42+energy*1.15)*100) / 100

	var title, artStyle, typography, mood, moodLabel, note string
	var palette [3]string
	var grain float64

	switch {
	case energy >= 0.74 || containsAny(combined, "дедлайн", "сдач", "офис", "ноч", "электрон", "electronic", "techno", "rock", "hip-hop", "драйв", "бег", "спорт", "тренир"):
		title = pickFallbackTitle(lowerText, "Ночь в ритме большого города", "Собранный темп перед целью")
		artStyle = "kinetic_zine"
		typography = "mono_archive"
		mood = "energetic"
		moodLabel = "Высокий ритм"
		palette = [3]string{"#10131A", "#D8FF4B", "#F4EFE6"}
		grain = 0.24
		note = fmt.Sprintf("Контрастные линии и ускоренный пульс под «%s» фиксируют собранную динамику дня.", track.Title)

	case containsAny(combined, "дожд", "ливн", "груст", "устал", "тоск", "пасмур", "туман", "тишин", "одинок", "одиноч", "ambient", "classical", "закат"):
		title = pickFallbackTitle(lowerText, "Тихий вечер и мягкий дождь", "Спокойная пауза на закате")
		artStyle = "dreamy_aura"
		typography = "serif_editorial"
		if containsAny(lowerText, "груст", "устал", "тоск", "тяжел", "тяжёл", "дожд", "одинок", "одиноч") {
			mood = "sad"
			moodLabel = "Тихая глубина"
		} else {
			mood = "calm"
			moodLabel = "Мягкое созерцание"
		}
		palette = [3]string{"#141221", "#C6A4FF", "#F2ECFA"}
		grain = 0.36
		note = fmt.Sprintf("Рассеянные световые ореолы и плавный ритм «%s» оставляют воздух для этого дня.", track.Title)

	case containsAny(combined, "утр", "рассвет", "ясн", "фокус", "учеб", "учёб", "работ", "книг", "план", "библиотек"):
		title = pickFallbackTitle(lowerText, "Ясное утро и чистый фокус", "Светлый ритм спокойного дня")
		artStyle = "minimal_editorial"
		typography = "mono_archive"
		if containsAny(lowerText, "радост", "счаст", "солнц", "улыб", "друз", "праздн") {
			mood = "happy"
			moodLabel = "Светлая ясность"
		} else {
			mood = "calm"
			moodLabel = "Ясный фокус"
		}
		palette = [3]string{"#10161D", "#7FE3FF", "#EDF3F8"}
		grain = 0.22
		note = fmt.Sprintf("Чистая сетка и выверенный свет под «%s» сохраняют ощущение собранного дня.", track.Title)

	case containsAny(combined, "смех", "смея", "друз", "праздн", "радост", "счаст", "весел", "весё", "побед", "концерт"):
		title = pickFallbackTitle(lowerText, "Тёплая встреча и живой смех", "Яркий день рядом со своими")
		artStyle = "analog_film"
		typography = "serif_editorial"
		mood = "happy"
		moodLabel = "Живая радость"
		palette = [3]string{"#1A1410", "#F0A858", "#FAF1E4"}
		grain = 0.42
		note = fmt.Sprintf("Живой плёночный свет и ритм «%s» бережно удерживают тепло этой встречи.", track.Title)

	default:
		title = pickFallbackTitle(lowerText, "Тёплый свет прожитого дня", "Прогулка и спокойные детали")
		artStyle = "analog_film"
		typography = "serif_editorial"
		mood = "warm"
		moodLabel = "Тёплый уют"
		palette = [3]string{"#1B1512", "#E59A54", "#F5ECE0"}
		grain = 0.46
		note = fmt.Sprintf("Камерный свет и мягкое плёночное зерно хранят живое ощущение дня под «%s».", track.Title)
	}

	// Учёт предпочтений из описания профиля пользователя
	personalizationNote := ""
	if strings.TrimSpace(user.Bio) != "" {
		switch {
		case containsAny(lowerBio, "минимал", "чист", "сетк", "график", "архитектур"):
			if artStyle == "analog_film" {
				artStyle = "minimal_editorial"
			}
			grain = clampFloat(grain-0.12, 0.14, 0.7)
			personalizationNote = "Учтено стремление к минимализму из вашего профиля: композиция сделана чище, с меньшим зерном."
		case containsAny(lowerBio, "плён", "плен", "винтаж", "кино", "аналог", "фото"):
			grain = clampFloat(grain+0.12, 0.25, 0.72)
			personalizationNote = "С учётом вашего интереса к плёнке и фотографии усилена живая аналоговая фактура кадра."
		case containsAny(lowerBio, "ноч", "контраст", "кибер", "электрон", "динамик"):
			if artStyle == "minimal_editorial" {
				artStyle = "kinetic_zine"
			}
			personalizationNote = "С учётом вашего профиля добавлен более контрастный свет и собранный графический ритм."
		default:
			personalizationNote = "Подача и тон карточки настроены с опорой на описание вашего профиля."
		}
	}

	// Подмешиваем реальную извлечённую палитру фотографий
	if visuals.HasColor {
		palette = [3]string{visuals.BgHex, visuals.AccentHex, visuals.LightHex}
	}

	albumTail := "одиночный кадр работает как цельная открытка дня."
	if photoCount > 1 {
		albumTail = fmt.Sprintf("альбом из %d кадров плавно сменяется в такт песне.", photoCount)
	}
	curatorSummary := fmt.Sprintf(
		"Оформление собрано под настроение «%s»: свет и оттенки фото соединяются с треком «%s» (%s, темп %.1fx), а %s",
		strings.ToLower(moodLabel),
		track.Title,
		track.Artist,
		motionSpeed,
		albumTail,
	)

	return title, StyleRecipe{
		Palette:             palette,
		GrainIntensity:      math.Round(grain*100) / 100,
		ArtStyle:            artStyle,
		MotionSpeed:         motionSpeed,
		TypographyVariant:   typography,
		AtmosphereNote:      note,
		Mood:                mood,
		MoodLabel:           moodLabel,
		CuratorSummary:      curatorSummary,
		PersonalizationNote: personalizationNote,
		AIGenerated:         false,
	}
}

func pickFallbackTitle(lowerText, primary, secondary string) string {
	switch {
	case containsAny(lowerText, "парк") && containsAny(lowerText, "какао", "кофе", "чай"):
		return "Осенний парк и тёплое какао"
	case containsAny(lowerText, "дожд", "ливн") && containsAny(lowerText, "прогул", "гуля", "улиц"):
		return "Тихая прогулка после дождя"
	case containsAny(lowerText, "офис", "проект", "дедлайн", "сдач"):
		return "Ночной фокус перед сдачей"
	case containsAny(lowerText, "кофе", "какао", "чай"):
		return "Тёплая чашка и тихий вечер"
	case containsAny(lowerText, "друз", "подруг", "встрет"):
		return "Тёплая встреча в кругу близких"
	case containsAny(lowerText, "закат", "небо", "сумерк"):
		return "Закатный свет в конце дня"
	}
	if utf8.RuneCountInString(lowerText)%2 == 0 {
		return primary
	}
	return secondary
}

type colorAccumulator struct {
	sumR, sumG, sumB float64
	accR, accG, accB float64
	accWeight        float64
	totalPixels      float64
}

func sampleImageColors(path string, acc *colorAccumulator) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return
	}

	bounds := img.Bounds()
	w := bounds.Dx()
	h := bounds.Dy()
	if w <= 0 || h <= 0 {
		return
	}

	stepX := maxInt(1, w/24)
	stepY := maxInt(1, h/24)

	for y := bounds.Min.Y; y < bounds.Max.Y; y += stepY {
		for x := bounds.Min.X; x < bounds.Max.X; x += stepX {
			r16, g16, b16, _ := img.At(x, y).RGBA()
			r := float64(r16>>8) / 255.0
			g := float64(g16>>8) / 255.0
			b := float64(b16>>8) / 255.0

			acc.sumR += r
			acc.sumG += g
			acc.sumB += b
			acc.totalPixels++

			_, sat, lum := rgbToHSL(r, g, b)
			// Выразительные пиксели (не слишком тёмные и не выжженно-белые) задают акцент
			if lum > 0.16 && lum < 0.86 {
				weight := 0.25 + sat*sat*3.0
				acc.accR += r * weight
				acc.accG += g * weight
				acc.accB += b * weight
				acc.accWeight += weight
			}
		}
	}
}

func extractPhotoVisuals(localPhotoPaths []string) photoVisuals {
	if len(localPhotoPaths) == 0 {
		return photoVisuals{}
	}

	var acc colorAccumulator
	for _, path := range localPhotoPaths {
		sampleImageColors(path, &acc)
	}

	if acc.totalPixels == 0 {
		return photoVisuals{}
	}

	avgR, avgG, avgB := acc.sumR/acc.totalPixels, acc.sumG/acc.totalPixels, acc.sumB/acc.totalPixels
	avgH, avgS, avgL := rgbToHSL(avgR, avgG, avgB)

	var accentH, accentS float64
	if acc.accWeight > 0 {
		accentH, accentS, _ = rgbToHSL(acc.accR/acc.accWeight, acc.accG/acc.accWeight, acc.accB/acc.accWeight)
	} else {
		accentH, accentS = avgH, math.Max(0.35, avgS)
	}

	// Строим гармоничную и читаемую тройку: глубокий фон, живой акцент, тёплая светлая бумага
	bgHex := hslToHex(avgH, clampFloat(avgS*0.55, 0.14, 0.42), 0.09)
	accentHex := hslToHex(accentH, clampFloat(math.Max(accentS, 0.48), 0.45, 0.85), 0.64)
	lightHex := hslToHex(accentH, clampFloat(accentS*0.28, 0.08, 0.24), 0.93)

	warmth := "neutral"
	warmthRu := "нейтральные оттенки"
	if accentS >= 0.18 {
		if (accentH >= 0 && accentH <= 62) || accentH >= 325 {
			warmth = "warm"
			warmthRu = "тёплые оттенки"
		} else {
			warmth = "cool"
			warmthRu = "прохладные оттенки"
		}
	}

	brightness := "balanced"
	brightRu := "сбалансированный свет"
	if avgL < 0.32 {
		brightness = "dark"
		brightRu = "приглушённый вечерний свет"
	} else if avgL > 0.64 {
		brightness = "bright"
		brightRu = "яркий дневной свет"
	}

	return photoVisuals{
		HasColor:    true,
		BgHex:       bgHex,
		AccentHex:   accentHex,
		LightHex:    lightHex,
		Warmth:      warmth,
		Brightness:  brightness,
		Description: warmthRu + ", " + brightRu,
	}
}

func rgbToHSL(r, g, b float64) (float64, float64, float64) {
	maxV := math.Max(r, math.Max(g, b))
	minV := math.Min(r, math.Min(g, b))
	l := (maxV + minV) / 2.0

	if maxV == minV {
		return 0, 0, l
	}

	d := maxV - minV
	var s float64
	if l > 0.5 {
		s = d / (2.0 - maxV - minV)
	} else {
		s = d / (maxV + minV)
	}

	var h float64
	switch maxV {
	case r:
		h = (g - b) / d
		if g < b {
			h += 6
		}
	case g:
		h = (b-r)/d + 2
	default:
		h = (r-g)/d + 4
	}
	h *= 60
	return h, s, l
}

func hslToHex(h, s, l float64) string {
	h = math.Mod(h, 360)
	if h < 0 {
		h += 360
	}
	c := (1 - math.Abs(2*l-1)) * s
	x := c * (1 - math.Abs(math.Mod(h/60.0, 2)-1))
	m := l - c/2

	var r, g, b float64
	switch {
	case h < 60:
		r, g, b = c, x, 0
	case h < 120:
		r, g, b = x, c, 0
	case h < 180:
		r, g, b = 0, c, x
	case h < 240:
		r, g, b = 0, x, c
	case h < 300:
		r, g, b = x, 0, c
	default:
		r, g, b = c, 0, x
	}

	ri := int(math.Round(clampFloat((r+m)*255, 0, 255)))
	gi := int(math.Round(clampFloat((g+m)*255, 0, 255)))
	bi := int(math.Round(clampFloat((b+m)*255, 0, 255)))
	return fmt.Sprintf("#%02X%02X%02X", ri, gi, bi)
}

func isValidHex(value string) bool {
	if len(value) != 7 || value[0] != '#' {
		return false
	}
	for i := 1; i < 7; i++ {
		ch := value[i]
		if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')) {
			return false
		}
	}
	return true
}

func clampFloat(v, minV, maxV float64) float64 {
	if v < minV {
		return minV
	}
	if v > maxV {
		return maxV
	}
	return v
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
