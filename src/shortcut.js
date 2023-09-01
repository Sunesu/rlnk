const {shell} = require('electron');
const fs = require('fs');

function create_lnk({path,target,args,icon}){
    shell.writeShortcutLink(path,"create",{
        target,
        args,
        icon,
        iconIndex: 0
    })
}

function create_url({path,target,icon}) {
    var data = `[InternetShortcut]\n\rURL=${target}\n\rWorkingDirectory=${path}\n\rIconIndex=0\n\rIconFile=${icon}`;
    fs.writeFileSync(path,data,{encoding:'utf-8'});
}

function create({path,target,args,icon}){
    switch (true) {
        case path.endsWith('.lnk'):
            return create_lnk({path,target,args,icon})
        case path.endsWith('.url'):
            return create_url({path,target,icon})
        default:
            break;
    }
}

module.exports = {
    create
}