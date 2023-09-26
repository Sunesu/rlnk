# rlnk
An Electron app that allows you to create shortcuts for your favorite roblox games.

## Features
- Easy to use
    - No need to copy your roblox cookie - rlnk will extract it automatically
    - Added accounts are saved for easy access later
- Multiple shortcuts types
    - game
    - private server
    - user *(coming soon)*
- Ability to launch game via CLI: `/path/to/rlnk game;https://www.roblox.com/games/606849621/Jailbreak`
- Nice account manager

## Installation
Windows installer can be found on [our website](https://rlnk.app)

## Building

Clone the repository

```
git clone https://github.com/Sunesu/rlnk.git
```

cd into rlnk

```
cd rlnk
```

Install dependencies

```
npm install
```

and build

```
npm run build
```

## Roadmap
- [x] alternative .NET app for lower-end devices -> [download here](https://rlnk.app/lite)
- [x] ability to login instead of pasting an account cookie
- [x] user shortcuts 
- [x] specific [JobId](https://create.roblox.com/docs/reference/engine/classes/DataModel#JobId) shortcuts
- [x] browser shortcuts
- [x] roblox studio shortcuts
- [ ] Server filtering options for game shortcut:
    - [ ] playercount:
        - order `ascending`/`descending`/`random`
        - `min` & `max` amount of players
    - [ ] ping:
        - same as players: customizable order, min & max value
- [ ] ability to remove an account from account manager
- [ ] better error handling


## License

[MIT](LICENSE)
