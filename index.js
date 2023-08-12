const { app, BrowserWindow, Notification, screen, ipcMain, shell, ipcRenderer, session } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const pngToIco = require('png-to-ico');
const request = require('request');
const {exec} = require('child_process');
const crypto = require('crypto');
const jsoning = require('jsoning');

const {launchOptions} = require('./src/common');
const {reverseObject,getFirefoxCookie,getBraveCookie,getChromeCookie,getOperaGXCookie} = require('./src/utils');

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
				preload: path.join(__dirname, 'js/preload.js')
			}
		});
		errwin.removeMenu();
		errwin.loadFile('html/login_error.html')
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
			preload: path.join(__dirname, 'js/preload.js')
		}
	});
	win.removeMenu();
	win.loadFile('html/index.html');
	win.webContents.on('did-finish-load', function() {
		win.show(); 
	});

}

/**
 * Get auth ticket from roblox api
 * @param {string} cookie 
 * @returns {string} authTicket
 */
async function getAuthTicket(cookie){
	var authTicket;
	var CSRF_TOKEN = cookiesDB.get('x-csrf-token');
	await axios.post('https://auth.roblox.com/v1/authentication-ticket',{},{
		headers: {
			'Cookie': `.ROBLOSECURITY=${cookie}`,
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:99.0) Gecko/20100101 Firefox/99.0',
			'Accept': '*/*',
			'Accept-Language': 'en-US;q=0.7,en;q=0.3',
			'Accept-Encoding': 'gzip, deflate, br',
			'Content-Type': 'application/json',
			'x-csrf-token': CSRF_TOKEN,
			'Origin': 'https://www.roblox.com',
			'Connection': 'keep-alive',
			'Referer': 'https://www.roblox.com/',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Site': 'same-site',
			'Content-Length': 0,
			'TE': 'trailers'
		}
	})
	.then(async function (response) {
		// handle success
		console.log('success getting ticket')
		authTicket = response.headers['rbx-authentication-ticket'];
		return;
	})
	.catch(async function (error) {
		// handle error
		console.log(error);
		await cookiesDB.set('x-csrf-token',error.response.headers['x-csrf-token']);
		authTicket = await getAuthTicket(cookie);
		return authTicket;
	})
	.then(function () {
		// always executed
	});
	return authTicket;
}

function findRobloxPath(dir=`${process.env.LOCALAPPDATA}\\Roblox\\Versions`){
	if(!fs.existsSync(dir)) return (dir === `${process.env.LOCALAPPDATA}\\Roblox\\Versions`) ? findRobloxPath(`${process.env["programfiles(x86)"]}\\Roblox\\Versions`) : ["",0]
	var modifyTimesMs = fs.readdirSync(dir).map((val)=>{
		var stat = fs.statSync(`${dir}\\${val}`)
		if(!fs.existsSync(`${dir}\\${val}\\RobloxPlayerBeta.exe`)) return 0 //checking every folder for RobloxPlayerBeta.exe
	    return stat.isDirectory() ? stat.mtime.getTime() : 0 // if val is a directory return time else 0
	})
	var latestModifyDateSoFar = Math.max(...modifyTimesMs)
	var appPath = `${dir}\\${fs.readdirSync(dir)[modifyTimesMs.indexOf(latestModifyDateSoFar)]}\\RobloxPlayerBeta.exe`

	if (dir===`${process.env.LOCALAPPDATA}\\Roblox\\Versions`){
		var [nextAppPath,AnotherLatestModifyDate] = findRobloxPath(`${process.env["programfiles(x86)"]}\\Roblox\\Versions`)
		if (AnotherLatestModifyDate>latestModifyDateSoFar){
			appPath = nextAppPath
			latestModifyDateSoFar = AnotherLatestModifyDate
		}
	}

	return [appPath,latestModifyDateSoFar]
}

/**
 * Launches roblox player without using a web browser
 * @param {string} placeId 
 * @param {string} cookie 
 * @param {launchOptions} options 
 */
async function launchDirectly(placeId,cookie,options){
	var appPath = findRobloxPath()[0]
	var authTicket = await getAuthTicket(cookie);
	var launchtime = Date.now();
	var browserTrackerId = Math.floor(Math.random()*1231324234)+1
	//var redeemUrl = "https://www.roblox.com/Login/Negotiate.ashx"
	var joinscriptUrl = makeJoinScriptUrl(placeId,browserTrackerId,options?.privateServerLinkCode);
	var launchCommand = `"${appPath}" --app -t ${authTicket} -j "${joinscriptUrl}" -b ${browserTrackerId.toString()} --launchtime=${launchtime.toString()} --rloc en_us --gloc en_us`
    
	console.log(launchCommand);
	exec(launchCommand,(err,stdout,stderr)=>{
		process.exit(1);
	})
}

/**
 * 
 * @param {string} placeId 
 * @param {number} browserTrackerId 
 * @param {string} privateServerLinkCode - optional
 */
function makeJoinScriptUrl(placeId,browserTrackerId,privateServerLinkCode){
	if(privateServerLinkCode) return `https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestPrivateGame&browserTrackerId=${browserTrackerId}&placeId=${placeId}&accessCode=&linkCode=${privateServerLinkCode}`
	return `https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGame&browserTrackerId=${browserTrackerId}&placeId=${placeId}&isPlayTogetherGame=false&joinAttemptId=${crypto.randomUUID()}&joinAttemptOrigin=PlayButton`
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
		if(runArgs.length === 3) robloxCookie = cookiesDB.get(runArgs[2]);

		var id = runArgs[1].match(/\/(\d+)/)[1];
		var privateServerLinkCode = runArgs[1].match(/privateServerLinkCode=(\S+)/)?.[1] || undefined;

		if(runArgs[0]==='user') return process.exit(1); // TODO user shortcuts
		if(runArgs[0]==='server') return launchDirectly(id,robloxCookie,{privateServerLinkCode: privateServerLinkCode});
		if(runArgs[0]==='game') return launchDirectly(id,robloxCookie);
		
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

async function getGameName(placeId){
	var toreturn = undefined;
	await getCookie().then(async(cookie)=>{
		await axios.get(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`,{
			headers:{
				'Cookie': `.ROBLOSECURITY=${cookie}`,
			}
		}).then(async(res)=>{
			toreturn = res.data[0].name;
			return;
		})
		.catch(function (error) {
			console.log(error);
		})
		.then(function () {
			// always executed
		});
	})
	.catch(function (error) {
		console.log(error);
	})
	return toreturn;
}


async function getUserInfo(cookie){
	var {data} = await axios.get('https://users.roblox.com/v1/users/authenticated',{headers:{'Cookie': `.ROBLOSECURITY=${cookie}`,'Accept': 'application/json'}})
	return data;
}

async function checkAccountMetadata(id){
	var metadata = await cookiesDB.get(`${id}_metadata`)
	if(!metadata) return undefined
	if(Date.now() > metadata.ts + 604800000) return undefined
	return metadata
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

	if(shortcutData.type === 'user') return // TODO user shortcuts 
	
	const placeId = shortcutData.link.match(/\/(\d+)/)[1];
	const iconPNGPath = path.join(process.env.APPDATA,app.name,`GAME_${placeId}.png`);
	const iconICOPath = path.join(process.env.APPDATA,app.name,`GAME_${placeId}.ico`);
	const iconEXEPath = path.join(process.env.APPDATA,app.name,`GAME_${placeId}.exe`);
	const mainEXEPath = path.dirname(process.execPath) + `/${app.name}.exe`;

	// getting basic game info
	const gameName = await getGameName(placeId);

	if(!gameName) return showErrorWindow("Login error","Please open Roblox Studio and log in");

	var shortcutArgs = `${shortcutData.type};${shortcutData.link}`;
	var shortcutPath = path.join(process.env.USERPROFILE,'Desktop',`${gameName}.lnk`);

	// getting icon
	var {data} = await axios.get(`https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=256x256&format=Png&isCircular=${shortcutData.circularIcon}`)

	
	if(shortcutData.account === 'custom'){ // 
		var {id,displayName} = await getUserInfo(shortcutData.cookie);
		await cookiesDB.set(id.toString(),shortcutData.cookie);
		shortcutArgs = `${shortcutData.type};${shortcutData.link};${id}`;
		shortcutPath = path.join(process.env.USERPROFILE,'Desktop',`${gameName} - ${displayName}.lnk`);
	}
	else if(shortcutData.account !== 'default'){
		var meta = await cookiesDB.get(shortcutData.account.toString()+'_metadata');
		shortcutArgs = `${shortcutData.type};${shortcutData.link};${meta.id}`;
		shortcutPath = path.join(process.env.USERPROFILE,'Desktop',`${gameName} - ${meta.displayName}.lnk`);
	}

	console.log(`shortcutArgs: ${shortcutArgs}\n shortcutPath: ${shortcutPath}`);

    // downloading game icon
	var download_req = request({
		method: 'GET',
		uri: data.data[0].imageUrl,
	});

	download_req.pipe(fs.createWriteStream(iconPNGPath));
	
	download_req.on('end', function () { //icon successfully downloaded lets go!
		pngToIco(iconPNGPath).then(buf => {
			fs.writeFile(iconICOPath, buf,(err)=>{
				if(err) return err;
				exec(`copy /Y "${path.join(__dirname,'empty.exe')}" "${iconEXEPath}"`,(err,stdout,stderr)=>{ // copy dummy exe file
					exec(`"${path.join(__dirname,'rcedit')}" "${iconEXEPath}" --set-icon "${iconICOPath}"`,(err,stdout,stderr)=>{ // change exe icon
						console.log(`rcedit "${iconEXEPath}" --set-icon "${iconICOPath}"`);
						shell.writeShortcutLink(shortcutPath,"create",{
							target: mainEXEPath,
							args: shortcutArgs,
							icon: iconEXEPath,
							iconIndex: 0
						})
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