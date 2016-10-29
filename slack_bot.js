/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/


This is a sample Slack bot built with Botkit.

This bot demonstrates many of the core features of Botkit:

* Connect to Slack using the real time API
* Receive messages based on "spoken" patterns
* Reply to messages
* Use the conversation system to ask questions
* Use the built in storage system to store and retrieve information
  for a user.

# RUN THE BOT:

  Get a Bot token from Slack:

    -> http://my.slack.com/services/new/bot

  Run your bot from the command line:

    token=<MY TOKEN> node slack_bot.js

# USE THE BOT:

  Find your bot inside Slack to send it a direct message.

  Say: "Hello"

  The bot will reply "Hello!"

  Say: "who are you?"

  The bot will tell you its name, where it running, and for how long.

  Say: "Call me <nickname>"

  Tell the bot your nickname. Now you are friends.

  Say: "who am I?"

  The bot will tell you your nickname, if it knows one for you.

  Say: "shutdown"

  The bot will ask if you are sure, and then shut itself down.

  Make sure to invite your bot into other channels using /invite @<my bot>!

# EXTEND THE BOT:

  Botkit has many features for building cool and useful bots!

  Read all about it here:

    -> http://howdy.ai/botkit

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/


if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('./lib/Botkit.js');
var os = require('os');
var request = require('request');

var controller = Botkit.slackbot({
    debug: true
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM();


controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });


    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hello.');
        }
    });
});

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function(err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function(bot, message) {

    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Your name is ' + user.name);
        } else {
            bot.startConversation(message, function(err, convo) {
                if (!err) {
                    convo.say('I do not know your name yet!');
                    convo.ask('What should I call you?', function(response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, {'key': 'nickname'}); // store the results in a field called nickname

                    convo.on('end', function(convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function(err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user,
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function(err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                            });



                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
});


controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.startConversation(message, function(err, convo) {

        convo.ask('Are you sure you want me to shutdown?', [
            {
                pattern: bot.utterances.yes,
                callback: function(response, convo) {
                    convo.say('Bye!');
                    convo.next();
                    setTimeout(function() {
                        process.exit();
                    }, 3000);
                }
            },
        {
            pattern: bot.utterances.no,
            default: true,
            callback: function(response, convo) {
                convo.say('*Phew!*');
                convo.next();
            }
        }
        ]);
    });
});


controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}


controller.hears(['sysinfo'], 'direct_message,direct_mention,mention', function(bot, message) {

    var myMessage = "====================\n";
    if (os != undefined)
    {
        myMessage += "CPU: " + os.cpus()[0].model + "\n";
        myMessage += "Cores: " + os.cpus().length + "\n";
        myMessage += "Platform: " + os.platform() + "\n";
        myMessage += "Release: " + os.release(); + "\n";
        myMessage += "Type: " + os.type() + "\n";
        myMessage += "Total Memory: " + formatBytes(os.totalmem());

    }
    myMessage += "\n====================";


    bot.reply(message,myMessage);
  
});

function formatBytes(b)
{
    var unit = "";
    var count = 0;

    while(b > 1024)
    {
        b = b/1024;
        count++;
    }

    switch(count)
    {
        case 0:
            unit="B";
            break;
        case 1:
            unit="KB"
            break;
        case 2:
            unit="MB"
            break;
        case 3:
            unit="GB"
            break;
        case 4:
            unit="TB"
            break;
        default:
            break;
    }
    
    return b.toFixed(2) + " " + unit;
}

controller.hears(['doge'],['ambient'], function(bot, message) {

    var endpoint = "http://imgur.com/r/doge/hot.json";

    request(endpoint, function (err, response, body) {
        var info = [];
        var datap = [];

        if (!err && response.statusCode === 200) {
            body = JSON.parse(body);
            datap = body.data;
            //info.push(datap);
            //info.push("length:" + datap.length);

            var randomNum = randomIntInc(0,datap.length);

            info.push("http://i.imgur.com/" + datap[randomNum].hash + ".jpg");

            // info.push('Gem: ' + body.name + ' - ' + body.info);
            // info.push('Authors: ' + body.authors);
            // info.push('Project URI: ' + body.project_uri);

            // info.push('channel: ' + param.channel)
            // info.push('alias: ' + param.alias);
        }
        else {
            // info = ['No such gem found!'];
            info = ['no pictures found'];
        }

        //util.postImageLink(channel, info.join('\n\n'));

        bot.reply(message,info.join('\n\n'));
    });


});

// Returns a random integer between min (inclusive) and max (inclusive)
function randomIntInc (low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}

controller.hears(['cat'],['ambient'],function(bot,message) {
   // bot.reply(message,"non-mentioned command triggered!");

    var endpoint = "http://catfacts-api.appspot.com/api/facts";

    request(endpoint, function (err, response, body) {
        var info = [];
        var datap = [];

        if (!err && response.statusCode === 200) {
            body = JSON.parse(body);
            //datap = body.data;

            console.log(body);
            bot.reply(message,"*Cat Fact*:\n" +
                body.facts + "\n" + 
                 "*Thank you for subscribing to cat facts!*:smiley_cat:");
        }
        else
        {
            bot.reply(message,"HTTP 200");
        }

        });
    });