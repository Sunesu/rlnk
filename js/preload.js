const {ipcRenderer, contextBridge} = require('electron');

contextBridge.exposeInMainWorld('ipc',ipcRenderer);

ipcRenderer.on('Accounts',(event,accounts)=>{
    console.log(accounts);
    showAccounts(accounts);
})

function showAccounts(accounts){
    if(!window.location.href.includes('accountManager')){
        for(const account in accounts){
            if(account == 0){
                document.querySelector('option[value=default]').innerText = accounts[account].displayName === accounts[account].username ? accounts[account].displayName : `${accounts[account].displayName} [${accounts[account].username}]`;
                continue;
            }
            var accountoption = document.createElement('option')
            accountoption.value = accounts[account].id;
            accountoption.innerText = accounts[account].displayName === accounts[account].username ? accounts[account].displayName : `${accounts[account].displayName} [${accounts[account].username}]`;
    
            document.getElementById('account').appendChild(accountoption)
        }
        document.querySelector('option[value=custom]').remove()
        var lastaccountoption = document.createElement('option');
        lastaccountoption.value = 'custom';
        lastaccountoption.innerText = 'Add account...';
        document.getElementById('account').appendChild(lastaccountoption)
    }
    else{
        for(const account in accounts){
            const ele = document.createElement('div');
            const usernameSpan = document.createElement('span');
            const browserButton = document.createElement('button');
            usernameSpan.innerText = accounts[account].displayName === accounts[account].username ? accounts[account].displayName : `${accounts[account].displayName} [${accounts[account].username}]`;
            browserButton.innerHTML = 'Open browser <span class="material-icons">open_in_new</span>'
            browserButton.onclick = openBrowser.bind(browserButton, accounts[account].cookie);
            browserButton.className = 'right'
            ele.appendChild(usernameSpan);
            ele.appendChild(browserButton);
            document.getElementById('accounts').appendChild(ele);
        }
    }
}

function openBrowser(cookie){
    ipcRenderer.send('setcookie',cookie);
}

if(window.location.href.startsWith('data:text')){
    document.styleSheets[0].insertRule('body{background-color:#202020;color:#fff;')
}