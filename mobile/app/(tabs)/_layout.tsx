import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { ArtSideMenu, ArtTopBar } from '../../components/ArtNavigation';
import { THEME } from '../../constants/theme';

export default function TabLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Tabs
        tabBar={() => null}
        screenOptions={{
          header: () => <ArtTopBar onOpenMenu={() => setMenuOpen(true)} />,
          sceneStyle: { backgroundColor: THEME.colors.bg },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="create" />
        <Tabs.Screen name="profile" />
      </Tabs>

      <ArtSideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}