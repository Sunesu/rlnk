var app = new Vue({
    el: '#app',
    data: {
        type: 'game', // other values will be 'user' and 'server' for vip server
        link: undefined, // game link or user profile link or vip server link
        account: 'default',
        circularIcon: false,
        cookie: undefined,
    },
    methods: {
        save: async function(e) {
            document.getElementById('create').innerHTML = 'Creating shortcut...'
            ipc.send('createShortcut',{
                'type': app.type,
                'link': app.link,
                'account': app.account,
                'circularIcon': app.circularIcon,
                'cookie': app.cookie
            })
            await new Promise((resolve)=>setTimeout(resolve,1000))
            document.getElementById('create').innerHTML = 'Create'
        },

        openAccountManager: function(e){
            window.location.href = 'accountManager.html'
        },
    }
})

ipc.send('accounts');