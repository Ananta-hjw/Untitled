import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // 스토어에 올리기 전에 본인 소유의 고유한 ID로 바꿔야 한다 (올린 뒤에는 바꿀 수 없다).
  appId: 'com.untitled.rpg',
  appName: 'Untitled RPG',
  webDir: 'dist',
  android: {
    backgroundColor: '#0d0907',
  },
};

export default config;
