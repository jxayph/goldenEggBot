var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');

var users = {};
var lobbies = [];

// This is stuff I copypasted because I don't know how to code
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});

logger.level = 'debug';

// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
const fs = require("fs");
bot.savedUsers = require('./savedUsers.json');

bot.on('ready', function (evt) {
    console.log('\nConnected');
    console.log('Logged in as: ');
    console.log(bot.username + ' - (' + bot.id + ')');
	
	loadSavedUsers();
});

bot.on('message', function (user, userID, channelID, message, evt) {
	if(evt.d.author.bot) return;
	console.log("-------------------");
	
	if(users[userID] == undefined) users[userID] = evt.d.author; // Register a new user.
		
    // Listening for command trigger '!'
    if (message.substring(0, 1) == '!') {
		// case insensitivity support. Arguments separated by whitespace.
        var args = message.toLowerCase().substring(1).split(' ');
		console.log(args);
        var cmd = args[0];
		var p = false;
       
        args = args.splice(1);
        switch(cmd) {
            // !ping
            case 'ping':
                bot.sendMessage({
                    to: channelID,
                    message: 'Pong!'
                });
				break;
				
			case 'rec':
		
				var numPlayers = args[0];
				var threshold = args[1];
				var pingMe = args[2];
                bot.sendMessage({
                    to: channelID,
                    message: makeLobby(userID, threshold, numPlayers, pingMe, channelID)
                });
				break;
			
			case 'lfg':
				var filter = args[0];
				showLobbies(channelID, filter);
				break;
			
			case 'join':		
				var lobbyID = args[0];
                bot.sendMessage({
                    to: channelID,
                    message: joinLobby(lobbyID, userID)
                });
				break;
			case 'close':
				bot.sendMessage({
					to: channelID,
					message: manualCloseLobby(userID)
				});
				break;
			case 'fc':
				var FC = args[0]
				bot.sendMessage({
					to: channelID,
					message: updateFriendCode(userID, FC)
				});
				break;
				
			case 'help':
				var command = args[0]
				bot.sendMessage({
					to: channelID,
					message: printHelp(command)
				});
				break;
					
			case 'save':
				bot.sendMessage({
					to: channelID,
					message: 'Saving users.'
				})
				if(userID == '319731113759211522'){
					bot.savedUsers[userID] = users[userID];
					fs.writeFile("./savedUsers.json", JSON.stringify(bot.savedUsers, null, 4), err => {
						if(err) throw err;
					});
				}
				break;
         }
     }
});

function loadSavedUsers(){
	console.log("Loading saved users...");
	users = bot.savedUsers;
}

function printHelp(command){
	switch(command){
		case undefined:
			return(
			'`!rec` - Open a lobby for matchmaking.  `!help rec` for more details.\n' +
			'`!close` - Close your matchmaking lobby. \n' +
			'`!lfg` - Display actively recruiting lobbies. `!help lfg` for more details.\n' +
			'`!join` - Join an actively recruiting lobby. `!help join` for more details.\n' +
			'`!fc` - Update your friend code. `!help fc` for more details.\n'
			)
			break;
			
		case 'rec':
			return(
			'!rec `num` `threshold` `+p` \n' +
			'`num` is the number of player slots open \n' +
			'`threshold` is the desired employee rank \n' +
			'add `+p` to the end if you want to be pinged when someone joins your lobby.'
			)
			break;
			
		case 'lfg':
			return(
			'!lfg `filter`\n' +
			'`filter` will only show you lobbies of a desired threshold'
			)
			break;
			
		case 'join':
			return(
			'!join `lobbyID`\n' +
			'`lobbyID` is the ID of the lobby you wish to join. The host may be pinged.'
			)
			break;
		
		case 'fc':
			return(
			'!fc `XXXXXXXXXXXX`\n' +
			'`XXXXXXXXXXXX` is your 12-digit Switch friend code, as 12 plain numbers.'
			)
			
			break;
	}
}


function updateFriendCode(userID, FC){
	var verify = verifyFC(FC);
	if(!verify[0]){
		return verify[1]; // Return, printing an error if format is wrong.
	}
	users[userID].FC = FC;
	var msg = '';
	
	msg += 'Updated ' + users[userID].username + "'s friend code to " + getFC(userID);
	return msg;
}

function verifyFC(FC){
	if(FC == undefined){
		var msg = 'Please enter a 12-digit number.'
		return([false,msg]);
	}
	if(FC.length != 12){
		var msg = 'Please enter a 12-digit number.'
		return( [false, msg]);
	}
	for(var i = 0; i < FC.length; i++){
		if(!isNumber(FC[i])){
			var msg = 'Invalid character detected. Please only enter numbers.'
			return ([false, msg]);
		}
	}
	return ([true,'']);
}

function isNumber(num){
	return (num.charCodeAt(0) > 47 && num.charCodeAt(0) < 58);
}

function joinLobby(lobbyID, playerID){
	if(lobbyID == undefined){
		var msg = 'Please enter a lobby ID.'
		return msg;
	}
	
	if(playerID == lobbies[lobbyID].hostID){
		var msg = "You can't join your own lobby."
		return msg;
	}
	
	if (lobbyID < lobbies.length && lobbyID >= 0){
		if(lobbies[lobbyID].num > 0){
			var msg = " Joining lobby " + lobbyID + lobbies[lobbyID].addPlayer(playerID);
			msg += "\nHost FC: `" + getFC(lobbies[lobbyID].hostID) + '`';
			return msg;
		}
		else{
			return "Lobby is full and will soon close.";
		}
	}
	else{
		return "Lobby index out of range.";
	}
	
}

function makeLobby(hostID, threshold, num, p, channelID){
	var ping = false;
	var madeNew = true;
	
	
	if ( !checkValidLobbyInput(threshold, num, channelID)) return;
	
	if (p != undefined){
		if (p[0]=='+'){
			if(p[1] == 'p') ping = true;
		}
	}
	var existingIndex = checkExistingLobby(hostID);
	
	if(existingIndex != -1){
		lobbies[existingIndex] = new Lobby(lobbies.length, hostID, threshold, num, ping);
		madeNew = false;
	}
	else
		lobbies.push(new Lobby(existingIndex, hostID, threshold, num, ping));
	
	var msg = '';
	if(madeNew)
		msg ='A lobby was made for ' + users[hostID].username + " with ID " + (lobbies.length - 1) + ".";
	else
		msg ='A lobby was replaced for ' + users[hostID].username + " with ID " + existingIndex + ".";
	if (ping) msg += ' Ping enabled.';
	
	return msg;
}

function manualCloseLobby(hostID){
	var lobbyIndex = getLobbyFromHostID(hostID);
	var msg = '';
	if(lobbyIndex == -1){
		msg += 'You do not have a lobby active.'
	}
	else {
		msg += "Closed lobby " + lobbyIndex + '.';
		lobbies.splice(lobbyIndex, 1);
	}
	
	return msg;
}


function getLobbyFromHostID(hostID){
	for(var i = 0; i < lobbies.length; i++){
		if (lobbies[i].hostID == hostID)
			return i;
	}
	return -1;
}
function checkExistingLobby(hostID){ // Return the index if found. Return -1 if not found.
	
	for (var i = 0; i < lobbies.length; i++){
		if (lobbies[i].hostID == hostID){
			return i;
		}
	}
	return -1;
}

function checkValidLobbyInput(threshold, num, channelID){
	if(num == undefined){
		bot.sendMessage({ 
			to: channelID,
			message: 'First argument must be a number from 1-3.'
		});
		return false;
	}
	
	if ( !isOneToThree(num) ){
		bot.sendMessage({ 
			to: channelID,
			message: '`' + num + '`' + ' is not a number from 1-3. First argument must be a number from 1-3.'
		});
		return false;
	}
	
	if(threshold == undefined){
		bot.sendMessage({ 
			to: channelID,
			message: 'Second argument must be `any` / `hlm` / `pro` / `o` / `gg` / `pt` / `a` / `i`'
		});
		return false;
		
	}
	
	if (getThreshold(threshold, 1) == undefined){
		bot.sendMessage({
			to: channelID,
			message: '"' + threshold + '" is not a valid  second argument. Please use `any` / `hlm` / `pro` / `o` / `gg` / `pt` / `a` / `i`'
		});
		return false;
	}
	
	return true;
}

function showLobbies(channelID, filter){
	if((filter != undefined) && (getThreshold(filter) == undefined)){
		bot.sendMessage({
			to:channelID,
			message: 'First argument must be blank or `any` / `hlm` / `pro` / `o` / `gg` / `pt` / `a` / `i`'
			});
			return;
	}
	var numFilter = 0;
	for( var i = 0; i < lobbies.length; i++){
		if(lobbies[i].threshold == filter || lobbies[i].threshold == 'any' || filter == undefined){
			bot.sendMessage({
			to:channelID,
			message: printLobby(lobbies[i], i),
			});
			numFilter++; // Want an error message if no lobbies matching the filter exist.
		}
	}
	
	if(lobbies.length == 0){
	bot.sendMessage({
		to:channelID,
		message: 'There are no active lobbies at this moment.'
		});
	}
	else if(numFilter == 0){
		bot.sendMessage({
		to:channelID,
		message: 'There are no matching lobbies at this moment.'
		});
	}
}

function isOneToThree(num){
	var charCode = num.charCodeAt(0);
	return (charCode > 48 && charCode < 52);
}

function printLobby(lobby, ID){
	var msg = "```";
	msg += "Lobby " + ID + ' | ';
	msg += "Host: " + users[lobby.hostID].username + ' | ' + getFC(lobby.hostID) + '\n';
	msg += "Recruiting " + lobby.num + " " + getThreshold(lobby.threshold, lobby.num) + '\n';
	msg += "Posted " + lobby.getTime() + "ago, expires in " + lobby.getExpiration()+ "\n";
	msg += "```";
	return msg;
}

function getThreshold(key, n){
	var thresholdDict = {
		'any': 'at any level',
		'hlm': 'for Hazard Level MAX',
		'pro': 'Profreshional',
		'o': 'Overachiever',
		'gg': 'Go-Getter',
		'pt': 'Part-Timer',
		'a': 'Apprentice',
		'i': 'Intern'		
	}
	var threshold = thresholdDict[key];
	if( n > 1 && key != 'hlm' && key != 'any') threshold += 's';
	return threshold;
}

// An object to represent an open lobby.
function Lobby(lobbyID_, hostID_, threshold_, num_, p_){
	this.lobbyID = lobbyID_;
	this.hostID = hostID_;
	this.threshold = threshold_;
	this.num = num_; // Number of open slots
	this.p = p_;
	this.timeOut = 1000*10*60; // 10 minutes
	this.madeAt = Date.now()/1000 // UTC timestamp in seconds.	
	
	this.getTime = function(){
		var elapsed = (Date.now()/1000 - this.madeAt)|0; // Elapsed time in seconds,
		var min = elapsed/60|0;
		var timeString = '';
		if( min > 0)
			timeString += (min + 'min '); 
		timeString += ( elapsed - 60*min) + 'sec ';
		
		return timeString; 
	}
	
	this.getExpiration = function(){
		var elapsed = (Date.now()/1000 - this.madeAt)|0;
		var remaining = (this.timeOut/1000 - elapsed)|0;
		var min = (remaining/60)|0;
		var timeString = ''
		
		if( min > 0)
			timeString += min + 'min ';
		timeString += (remaining - 60*min) + 'sec ';
		return timeString;
	}
	
	this.closeLobby = function(){	
		// Use splice to remove the lobby.
		console.log("Closing lobby " + this.lobbyID);
		lobbies.splice(this.lobbyID, 1);
		updateLobbyIDs();
		
	}
	
	this.addPlayer = function(playerID){
		var host = users[this.hostID];
		this.num--;
		if(this.num == 0){ // Delete a full lobby.
			setTimeout(this.closeLobby, 1000*2); // Closes the lobby after 2 seconds if it's full.
		}
		if(this.p){ // Ping the user if the p flag is enabled.
			//var msg = '@';
			var msg = ', <@' + host.id + '>.';
			return msg;
		} else return '.';
	}
	
	this.closeLobbyOnTimeout = function(){
		console.log("Closing lobby " + this.lobbyID);
		lobbies.splice(this.lobbyID, 1);
		updateLobbyIDs();
	}
	setTimeout(this.closeLobbyOnTimeout, this.timeOut);
}


function getFC(userID){
	if(users[userID].FC == undefined)
		return 'No friend code registered.';
	
	var rawFC = users[userID].FC;
	var FC = 'SW-';
	
	FC += rawFC.slice(0,4) + '-' + rawFC.slice(4, 8) + '-' + rawFC.slice(8);
	return FC;
}

function updateLobbyIDs(){
	for(var i = 0; i < lobbies.length; i++){
		lobbies[i].lobbyID = i;
	}
}

String.prototype.stringReplace = function(index, replacement){
	return this.substr(0, index) + replacement+ this.substr(index + replacement.length);
}
