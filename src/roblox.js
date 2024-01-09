const axios = require('axios');
const fs = require('fs');
const {exec} = require('child_process');
const crypto = require('crypto');
const jsoning = require('jsoning');
const path = require('path');

var xsrfDB = new jsoning(path.join(process.env.APPDATA,'rlnk',`xsrf.json`));

const {getFirefoxCookie,getBraveCookie,getChromeCookie,getOperaGXCookie} = require('./utils');

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

async function getUserInfo(cookie){
	var {data} = await axios.get('https://users.roblox.com/v1/users/authenticated',{headers:{'Cookie': `.ROBLOSECURITY=${cookie}`,'Accept': 'application/json'}})
	return data;
}

async function getUserName(id){
	var {data} = await axios.get(`https://users.roblox.com/v1/users/${id}`);
	return data.displayName;
}

async function getGameIdFromPrivateServerUrl(url){
    var {data} = await axios.get(`https://www.roblox.com/share-links?code=${url.match(/\/share\?code=([^&]+)/)[1]}&type=Server&pid=share&is_retargeting=true`,{
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1"
        },
    });
    return data.match(/<meta name="roblox:start_place_id" content="(\d+)">/)[1];
}

async function resolveShareLink(url,CSRF_TOKEN='undefined'){
    return new Promise((resolve)=>{
        getCookie().then(async(cookie)=>{
            await axios.post("https://apis.roblox.com/sharelinks/v1/resolve-link",{
                linkId: url.match(/\/share\?code=([^&]+)/)[1],
                linkType: 'Server'
            },{
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Content-Type": "application/json;charset=utf-8",
                    'Cookie': `.ROBLOSECURITY=${cookie};RBXEventTrackerV2=CreateDate=8/15/2023 12:08:07 PM&browserid=${Math.floor(Math.random()*1231324234)+1}`,
                    "x-csrf-token": CSRF_TOKEN,
                    "Sec-GPC": "1",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-site",
                    'referer': "https://www.roblox.com/"
                }
            })
            .then(async function (response) {
                resolve({
                    linkCode: response.data.privateServerInviteData.linkCode,
                    placeId: response.data.privateServerInviteData.placeId
                });
            })
            .catch(async function (error) {
                console.log(error)
                resolve(await resolveShareLink(url,error.response.headers['x-csrf-token']));
            })
        })
    })
}

async function resolveRobloxURL(u){
    if(/\/share\?code=([^&]+)/.test(u)){
        var {linkCode, placeId} = await resolveShareLink(u)
        return `https://www.roblox.com/games/${placeId}?privateServerLinkCode=${linkCode}` 
    }
    else{
        return u;
    }
}

async function getGameName(placeId){
	var toreturn = undefined;
	await getCookie().then(async(cookie)=>{
        var {data} = await axios.get(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`,{
			headers:{
				'Cookie': `.ROBLOSECURITY=${cookie}`,
			}
		});
        toreturn = data[0].name;
        return;
	})
	.catch(function (error) {
		console.log(error);
	})
	return toreturn;
}

function getLastServerData(){
    // first find the latest log file
    const robloxLogsPath = [process.env.LOCALAPPDATA,'Roblox','logs'];
    const logFiles = fs.readdirSync(path.join(...robloxLogsPath));    

    var modifyTimesMs = logFiles.map((filename)=>{
        return fs.statSync(path.join(...robloxLogsPath, filename)).ctime.getTime();
    });

    var latestTS = Math.max(...modifyTimesMs);
    var latestFile = logFiles[modifyTimesMs.indexOf(latestTS)];

    // now find placeId inside
    var data = fs.readFileSync(path.join(...robloxLogsPath,latestFile),{encoding:'utf-8'});
    return {placeId: data.match(/"placeId":(\d+)/)[1], jobId: data.match(/"jobId":"([^"]+)/)[1]};
}

/**
 * Gets roblox protocol launch url
 * @param {object} options
 * @param {string} [options.placeId]
 * @param {string} [options.privateServerLinkCode]
 * @param {string} [options.jobId]
 * @param {string} [options.userId]
 * @returns 
 */
function getRobloxProtocolURL(options){
    switch (true) {
        case (options.universeId != undefined) && (options.jobId != ''):
            return `roblox-studio://1+launchmode:1/:edit+task:EditPlace+placeId:${options.placeId}+universeId:${options.universeId}`
        case options.type == 'browser':
            return `roblox://app` // not sure whether this is the 'correct' way to lauch, but it works fine
        case options.userId != undefined:
            return `roblox://experiences/start?userId=${options.userId}`
        case (options.jobId != undefined) && (options.jobId != ''):
            return `roblox://experiences/start?placeId=${options.placeId}&gameInstanceId=${options.jobId}`
        case options.privateServerLinkCode != undefined:
            return `roblox://experiences/start?placeId=${options.placeId}&linkCode=${options.privateServerLinkCode}`
        default:
            return `roblox://experiences/start?placeId=${options.placeId}`
    }
}

function findStudioPath(){
    return `${process.env.LOCALAPPDATA}\\Roblox\\Versions\\RobloxStudioLauncherBeta.exe`;
}

/**
 * Finds latest roblox player installation
 * @param {string} dir optional
 * @returns {string} path to RobloxPlayerBeta.exe 
 */
function findRobloxPath(dir=`${process.env.LOCALAPPDATA}\\Roblox\\Versions`){
	if(!fs.existsSync(dir)) return (dir === `${process.env.LOCALAPPDATA}\\Roblox\\Versions`) ? findRobloxPath(`${process.env["programfiles(x86)"]}\\Roblox\\Versions`) : ["",0]
	
    var modifyTimesMs = fs.readdirSync(dir).map((val)=>{
		var stat = fs.statSync(`${dir}\\${val}`)
		if(!fs.existsSync(`${dir}\\${val}\\RobloxPlayerBeta.exe`)) return 0 //checking every folder for RobloxPlayerBeta.exe
	    return stat.isDirectory() ? stat.mtime.getTime() : 0 // if val is a directory return time else 0
	})

	var latestModifyDateSoFar = Math.max(...modifyTimesMs)
	var appPath = `${dir}\\${fs.readdirSync(dir)[modifyTimesMs.indexOf(latestModifyDateSoFar)]}\\RobloxPlayerBeta.exe`

    // if we only checked the first path then check another one
	if (dir===`${process.env.LOCALAPPDATA}\\Roblox\\Versions`){
		var [nextAppPath,AnotherLatestModifyDate] = findRobloxPath(`${process.env["programfiles(x86)"]}\\Roblox\\Versions`)
		if (AnotherLatestModifyDate>latestModifyDateSoFar){
			appPath = nextAppPath
			latestModifyDateSoFar = AnotherLatestModifyDate
		}
	}

    // if this is the first dir then return the path
	return dir==`${process.env["programfiles(x86)"]}\\Roblox\\Versions` ? [appPath,latestModifyDateSoFar] : appPath 
}

/**
 * Gets auth ticket from roblox api
 * @param {string} cookie 
 * @returns {string} authTicket
 */
async function getAuthTicket(cookie){
	var authTicket;
	var CSRF_TOKEN = xsrfDB.get('x-csrf-token');
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
		await xsrfDB.set('x-csrf-token',error.response.headers['x-csrf-token']);
		authTicket = await getAuthTicket(cookie);
		return authTicket;
	})
	.then(function () {
		// always executed
	});
	return authTicket;
}

/**
 * Launch roblox player without using a web browser
 * @param {string} placeId 
 * @param {string} cookie 
 * @param {object} options 
 * @param {string=} options.privateServerLinkCode
 * @param {string=} options.jobId
 */
async function launchDirectly(placeId,cookie,options){
	var appPath = findRobloxPath();
	var authTicket = await getAuthTicket(cookie);
	var launchtime = Date.now();
	var browserTrackerId = Math.floor(Math.random()*1231324234)+1
	//var redeemUrl = "https://www.roblox.com/Login/Negotiate.ashx"
	var joinscriptUrl = makeJoinScriptUrl(placeId,browserTrackerId,options);
	var launchCommand = `"${appPath}" --app -t ${authTicket} -j "${joinscriptUrl}" -b ${browserTrackerId.toString()} --launchtime=${launchtime.toString()} --rloc en_us --gloc en_us`
    
	console.log(launchCommand);
	exec(launchCommand,(err,stdout,stderr)=>{
		process.exit(1);
	})
}

async function launchStudio(placeId,universeId){
    var appPath = findStudioPath();
    var launchtime = Date.now();
    var browserTrackerId = Math.floor(Math.random()*1231324234)+1;

    var launchCommand = `"${appPath}" roblox-studio:1+launchmode:edit+launchtime:${launchtime.toString()}+distributorType:Global+browser:opera+task:EditPlace+placeId:${placeId}+universeId:${universeId}+avatar+browsertrackerid:${browserTrackerId}+robloxLocale:en_us+gameLocale:en_us`;

    exec(launchCommand,(err,stdout,stderr)=>{
		process.exit(1);
	})
}

/**
 * 
 * @param {string} placeId 
 * @param {number} browserTrackerId 
 * @param {object} options
 * @param {string=} options.privateServerLinkCode
 * @param {string=} options.jobId
 */
function makeJoinScriptUrl(placeId,browserTrackerId,options){
    if(options.userId) return `https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestFollowUser&browserTrackerId=${browserTrackerId}&userId=${options.userId}&joinAttemptId=${crypto.randomUUID()}`
    if(options.jobId) return `https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGameJob&browserTrackerId=${browserTrackerId}&placeId=${placeId}&gameId=${options.jobId}&isPlayTogetherGame=false&joinAttemptId=${crypto.randomUUID()}&joinAttemptOrigin=ServerListJoin`
	if(options.privateServerLinkCode) return `https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestPrivateGame&browserTrackerId=${browserTrackerId}&placeId=${placeId}&accessCode=&linkCode=${options.privateServerLinkCode}`
	return `https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGame&browserTrackerId=${browserTrackerId}&placeId=${placeId}&isPlayTogetherGame=false&joinAttemptId=${crypto.randomUUID()}&joinAttemptOrigin=PlayButton`
}

module.exports = {
    findRobloxPath,
    findStudioPath,
    getAuthTicket,
    launchDirectly,
    launchStudio,
    makeJoinScriptUrl,
    getRobloxProtocolURL,
    getUserInfo,
    getGameName,
    getGameIdFromPrivateServerUrl,
    resolveShareLink,
    resolveRobloxURL,
    getLastServerData,
    getUserName,
    getCookie
}