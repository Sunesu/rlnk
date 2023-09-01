const { app, BrowserWindow, Notification, screen, ipcMain, ipcRenderer, session } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const pngToIco = require('png-to-ico');
const request = require('request');
const {exec} = require('child_process');
const crypto = require('crypto');
const jsoning = require('jsoning');

const {reverseObject,getFirefoxCookie,getBraveCookie,getChromeCookie,getOperaGXCookie} = require('./src/utils');
const {launchDirectly,getRobloxProtocolURL,getUserInfo,getGameName,getUserName} = require('./src/roblox');
const shortcutUtils = require('./src/shortcut');

var cookiesDB = new jsoning(path.join(process.env.APPDATA,app.name,`cookies.json`));

var win;
var runArgs = process.argv[1]?.split(';') || [];

console.log(runArgs);

fs.stat(path.join(process.env.APPDATA,app.name,'chromiumUserData'),(err,stat)=>{
	if(err === 'ENOENT'){
		exec(`copy ${path.join(__dirname,'chromiumUserData')} ${path.join(process.env.APPDATA,app.name,'chromiumUserData')}`,(err,stdout,stderr)=>{
			console.log('DONE!');
			//yes
		})
	}
})

async function getCookie(all = false){
	var firefoxCookie = await getFirefoxCookie();
	var chromeCookie = await getChromeCookie();
	var operaookie = await getOperaGXCookie();
	var braveCookie = await getBraveCookie();

	if(all) return [firefoxCookie,chromeCookie,operaookie,braveCookie];
	if(firefoxCookie) return firefoxCookie;
	if(chromeCookie) return chromeCookie;
	if(operaookie) return operaookie;
	if(braveCookie) return braveCookie;
	
}

function showErrorWindow(str1,str2){

	//fs.writeFile('resources/app/errpage.html', errorTemplate(str1,str2,'#ff0000','linear-gradient(-45deg, #000000, #202020)') ,'utf8', (err) => {
	//	if (err) throw err;
		errwin = new BrowserWindow({
			//titleBarStyle: 'hidden',
			width: 500,
			height: 250,
			webPreferences: {
				preload: path.join(__dirname, 'renderer/js/preload.js')
			}
		});
		errwin.removeMenu();
		errwin.loadFile('renderer/html/login_error.html')
	//});
}

function createWindow () {

	var X = screen.getPrimaryDisplay().size.width
	var Y = screen.getPrimaryDisplay().size.height
	
	// create main browser window
	win = new BrowserWindow({
		//titleBarStyle: 'hidden',
		width: 650,
		height: 800,
		show: false,
		backgroundColor: '#290933',
		webPreferences: {
			preload: path.join(__dirname, 'renderer/js/preload.js')
		}
	});
	win.removeMenu();
	win.loadFile('renderer/html/index.html');
	win.webContents.on('did-finish-load', function() {
		win.show(); 
	});

}



if (runArgs.length === 1 || runArgs.length > 3) {
    exec("start https://www.youtube.com/watch?v=dQw4w9WgXcQ",(err,stdout,stderr)=>{
		//yes
		console.log(process.argv);
    	process.exit(1);
	});
}
else if(runArgs.length){
	console.log(process.argv)
	getCookie().then(async(studioCookie)=>{
		var robloxCookie = studioCookie;
		if(runArgs[0]==='jobid' && runArgs.length === 4) robloxCookie = cookiesDB.get(runArgs[3]);
        if(runArgs[0]!='jobid' && runArgs.length === 3) robloxCookie = cookiesDB.get(runArgs[2]);

		var id = runArgs[1].match(/\/(\d+)/)?.[1];
		var privateServerLinkCode = runArgs[1].match(/privateServerLinkCode=(\S+)/)?.[1] || undefined;

        switch (runArgs[0]) {
            case 'browser':
                return openBrowser(robloxCookie);
            case 'user':
                return launchDirectly('',robloxCookie,{userId:id});
            case 'jobid':
                return launchDirectly(id,robloxCookie,{jobId:runArgs[2]});
            case 'server':
                return launchDirectly(id,robloxCookie,{privateServerLinkCode: privateServerLinkCode});
            case 'game':
                return launchDirectly(id,robloxCookie,{});
        }
		
	});
    
}
else{
	app.whenReady().then(createWindow)
}
  
if (process.platform === 'win32')
{
	app.setAppUserModelId(app.name)
}

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
	  app.quit()
	}
})

app.on('activate', () => {
	if ((BrowserWindow.getAllWindows().length === 0) && runArgs.length === undefined) {
	  createWindow()
	}
})

async function checkAccountMetadata(id){
	var metadata = await cookiesDB.get(`${id}_metadata`)
	if(!metadata) return undefined
	if(Date.now() > metadata.ts + 604800000) return undefined
	return metadata
}

async function getNameForAShortcut(type,id){
    switch (type) {
        case 'browser':
            return 'Roblox';
        case 'user':
            return 'Join ' + (await getUserName(id));
        default:
            return getGameName(id);
    }
}

async function getIconForAShortcut(type,id,isCircular=false){
    switch (type) {
        case 'user':
        case 'browser':
            var {data} = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=180x180&format=Png&isCircular=${isCircular}`);
            return data.data[0].imageUrl;
        default:
            var {data} = await axios.get(`https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${id}&size=256x256&format=Png&isCircular=${isCircular}`);
            return data.data[0].imageUrl;
    }
}

async function getIdFromShortcutData(shd){
    // for browser shortcut, get userId from roblox api/json file
    // for other ones, extract it from game/user url
    return shd.type == 'browser' 
    ? (
        shd.cookie != ''
        ? (await getUserInfo(shd.cookie)).id 
        : (
            shd.account !== 'default'
            // account was saved before, so get user info from json file
            ? await cookiesDB.get(shd.account.toString()+'_metadata').id
            : (await getUserInfo(await getCookie())).id
        ))
    : shd.link.match(/\/(\d+)/)[1];
}

function openBrowser(cookie){
    session.defaultSession.cookies.remove('https://www.roblox.com', '.ROBLOSECURITY')
	const cookieObj = {url: 'https://www.roblox.com',domain: '.roblox.com',path: '/',httpOnly: true, name: '.ROBLOSECURITY', value: cookie}
    session.defaultSession.cookies.set(cookieObj, (error) => {
        if (error) console.error(error)
    }).then(()=>{
		var robloxWin = new BrowserWindow({
			width: screen.getPrimaryDisplay().size.width*0.75,
			height: screen.getPrimaryDisplay().size.height*0.75,
		});
		robloxWin.loadURL('https://www.roblox.com/');
	})
}

ipcMain.on('login', async function (event) {
    session.defaultSession.cookies.remove('https://www.roblox.com', '.ROBLOSECURITY');
    var robloxWin = new BrowserWindow({
        width:  370,//screen.getPrimaryDisplay().size.width*0.2,
        height: 550,//screen.getPrimaryDisplay().size.height*0.5,
        alwaysOnTop: true
    });
    robloxWin.removeMenu();
    robloxWin.loadURL('https://www.roblox.com/login');
    robloxWin.webContents.executeJavaScript('document.title = "Add account"');

    robloxWin.webContents.session.webRequest.onCompleted((d)=>{
        for(const key in d.responseHeaders){
            if(key == 'set-cookie'){
                if (/.ROBLOSECURITY=([^;]+)/.test(d.responseHeaders[key].join(' '))){
                    var extractedCookie  = d.responseHeaders[key].join(' ').match(/.ROBLOSECURITY=([^;]+)/)[1];
                    robloxWin.close();
                    win.webContents.send('loggedIn', extractedCookie); 
                }
            }
        }
    })
});

ipcMain.on('browseGames', async function (event) {
    session.defaultSession.cookies.remove('https://www.roblox.com', '.ROBLOSECURITY');
    var robloxWin = new BrowserWindow({
        width: screen.getPrimaryDisplay().size.width*0.75,
        height: screen.getPrimaryDisplay().size.height*0.75,
    });
    robloxWin.removeMenu();
    robloxWin.loadURL('https://www.roblox.com/discover');

    robloxWin.webContents.on('did-navigate',(e,url)=>{
        if(url.startsWith("https://www.roblox.com/games/")){
            robloxWin.close();
            win.webContents.send('gameSelected', url.replace(/\?.+/,''));
        }
    })
});

ipcMain.on('setcookie', async function (event,cookie) {
	openBrowser(cookie);
})

ipcMain.on('accounts', async function (event) {
	var allaccounts = cookiesDB.all();
	var browserCookies = await getCookie(true);
	//console.log(browserCookies);
	for (const browserCookie of browserCookies) {
		if(browserCookie){
			var mainAccInfo = await getUserInfo(browserCookie);
			allaccounts = reverseObject(allaccounts);
			allaccounts[mainAccInfo.id] = browserCookie;
			allaccounts = reverseObject(allaccounts);
		}	
	}
	var results = [];
	for(const acc in allaccounts){
		if(!isNaN(acc)){
			var metadata = await checkAccountMetadata(acc);
			if(metadata?.displayName && (metadata?.cookie === allaccounts[acc])){
				results.push(metadata)
			}
			else{
				try {
					var {name,displayName} = await getUserInfo(allaccounts[acc])
					var data = {
						"username": name,
						"displayName": displayName,
						"id":acc,
						"cookie":allaccounts[acc],
						"ts": Date.now()
					}
					results.push(data)
					console.log(`Processing ${displayName} with id ${acc}`)
					await cookiesDB.set(`${acc}_metadata`,data)
					await new Promise(resolve => setTimeout(resolve,200)) // wait some time before sending another request
				} catch (error) {
					console.log(`Cookie for ${acc} has expired`)
					cookiesDB.delete(acc);
				}
			}
		}
		// when loop ends send accounts to client
		if(acc === Object.keys(allaccounts)[Object.keys(allaccounts).length - 1]) win.webContents.send('Accounts', results); 
	}
})

ipcMain.on('createShortcut', async function (event,shortcutData) {
	
    // this can be a placeId or userId
	const objectId = await getIdFromShortcutData(shortcutData);

    // paths
	const iconPNGPath = path.join(process.env.APPDATA,app.name,`${shortcutData.type.toUpperCase()}_${objectId}.png`);
	const iconICOPath = path.join(process.env.APPDATA,app.name,`${shortcutData.type.toUpperCase()}_${objectId}.ico`);
	const iconEXEPath = path.join(process.env.APPDATA,app.name,`${shortcutData.type.toUpperCase()}_${objectId}.exe`);
	const mainEXEPath = path.dirname(process.execPath) + `/${app.name}.exe`;

	// getting basic game/user info
	const gameName = await getNameForAShortcut(shortcutData.type,objectId); //await getGameName(objectId);
	if(!gameName) return showErrorWindow();

    var isDirect = (shortcutData.launch_method == 'direct');

    // shortcut data
    var shortcutTarget = isDirect ? mainEXEPath : getRobloxProtocolURL({type: shortcutData.type, placeId: objectId, privateServerLinkCode: shortcutData.link.match(/privateServerLinkCode=(\S+)/)?.[1],jobId: shortcutData.jobid, userId: shortcutData.type == 'user' ? objectId : undefined})
	var shortcutArgs =  isDirect ? `${shortcutData.type};${shortcutData.link}` : '';
	var shortcutPath =  path.join(process.env.USERPROFILE,'Desktop',`${gameName}.${isDirect?'lnk':'url'}`);

    // add jobid to args
    if(shortcutData.jobid != '' && shortcutArgs != ''){
        shortcutArgs+=`;${shortcutData.jobid}`;
    }

	// get icon
	var iconURL = await getIconForAShortcut(shortcutData.type,objectId,shortcutData.isCircular);
	
	if(shortcutData.account === 'custom'){
        // if new account then get user info
		var {id,displayName} = await getUserInfo(shortcutData.cookie);
		await cookiesDB.set(id.toString(),shortcutData.cookie);
		shortcutArgs = `${shortcutData.type};${shortcutData.link};${id}`;
		shortcutPath = path.join(process.env.USERPROFILE,'Desktop',`${gameName} - ${displayName}.lnk`);
	}
	else if(shortcutData.account !== 'default'){
        // account was saved before, so get user info from json file
		var meta = await cookiesDB.get(shortcutData.account.toString()+'_metadata');
		shortcutArgs = `${shortcutData.type};${shortcutData.link};${meta.id}`;
		shortcutPath = path.join(process.env.USERPROFILE,'Desktop',`${gameName} - ${meta.displayName}.lnk`);
	}

	console.log(`shortcutArgs: ${shortcutArgs}\n shortcutPath: ${shortcutPath}`);

    // download game icon
	var download_req = request({
		method: 'GET',
		uri: iconURL,
	});

	download_req.pipe(fs.createWriteStream(iconPNGPath));
	
	download_req.on('end', function () { 
        // convert icon
		pngToIco(iconPNGPath).then(buf => {
            // save icon
			fs.writeFile(iconICOPath, buf,(err)=>{
				if(err) return err;
                // copy dummy exe file
				exec(`copy /Y "${path.join(__dirname,'empty.exe')}" "${iconEXEPath}"`,(err,stdout,stderr)=>{ 
                     // change exe icon
					exec(`"${path.join(__dirname,'rcedit')}" "${iconEXEPath}" --set-icon "${iconICOPath}"`,(err,stdout,stderr)=>{
						console.log(`rcedit "${iconEXEPath}" --set-icon "${iconICOPath}"`);
                        shortcutUtils.create({
                            path: shortcutPath,
                            target: shortcutTarget,
                            args: shortcutArgs,
                            icon: iconEXEPath
                        });
					});
				});
				//exec(`rcedit "${path.join(process.env.APPDATA,app.name,`GAME_${placeId}.exe`)}" --set-icon "${path.join(process.env.APPDATA,app.name,`GAME_${placeId}.ico`)}"`)
			});
			
		})
		.catch(console.error);
	});
	
})

module.exports = {
	window: win,
}