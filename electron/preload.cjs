'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, frozen read-only bridge without leaking Node.js APIs
contextBridge.exposeInMainWorld(
  'azkDesktop',
  Object.freeze({
    isElectron: true,
    platform: process.platform,
    toggleFullscreen: () => ipcRenderer.invoke('azk-desktop:toggle-fullscreen'),
    isFullscreen: () => ipcRenderer.invoke('azk-desktop:is-fullscreen'),
  })
);
