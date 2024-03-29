var app = new Vue({
    el: '#app',
    data: {
        type: 'game', // other values will be 'user' and 'server' for vip server
        link: '', // game link or user profile link or vip server link
        jobid: '',
        universeid: '',
        launch_method: 'direct',
        account: 'default',
        circularIcon: false,
        cookie: '',

        showButtonFor:['game','jobid','studio']
    },
    methods: {
        save: async function(e) {
            document.getElementById('create').innerHTML = 'Creating shortcut...'
            ipc.send('createShortcut',{
                'type': app.type,
                'link': app.link,
                'jobid': app.jobid,
                'universeid': app.universeid,
                'launch_method': app.launch_method,
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

        login: function(e){
            ipc.send('login');
        },

        browseGames: function(e){
            ipc.send('browseGames');
        }
    }
})

ipc.send('accounts');

// vue variables are not updated when changing element value
// so I made this workaround
setInterval(()=>{
    if(document.getElementById('cookie')){
        if(app.cookie == '' && document.getElementById('cookie').value != ''){
            // user logged in
            app.cookie = document.getElementById('cookie').value;
        }
    }
    if(document.getElementById('link')){
        if(app.link == '' && document.getElementById('link').value != ''){
            // user selected a game
            app.link = document.getElementById('link').value;
        }
    }
},200)