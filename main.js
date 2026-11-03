const { app, BrowserWindow, session, Menu, ipcMain, shell } = require('electron');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
ipcMain.on('get-user-data', (e) => { e.returnValue = app.getPath('userData'); });
ipcMain.on('get-app-path', (e) => { e.returnValue = app.getAppPath(); });
ipcMain.on('open-external', (_e, url) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); });

function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1280, height: 780, minWidth: 900, minHeight: 560,
    backgroundColor: '#0B0B10', title: 'Pelis LD', autoHideMenuBar: true,
    icon: require('path').join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false          // permite listas/streams http:// e sem CORS
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeSendHeaders((d, cb) => {
    d.requestHeaders['User-Agent'] = UA;
    cb({ requestHeaders: d.requestHeaders });
  });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
