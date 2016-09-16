//https://github.com/ashishbajaj99/mic
//https://www.npmjs.com/package/mic
//http://www.linuxcircle.com/2013/05/08/raspberry-pi-microphone-setup-with-usb-sound-card/
//https://subvisual.co/blog/posts/39-tutorial-html-audio-capture-streaming-to-node-js-no-browser-extensions
//http://nodered.org/docs/creating-nodes/node-js
//http://stackoverflow.com/questions/34364583/how-to-use-the-write-function-for-wav-module-in-nodejs
//http://noderedguide.com/index.php/2015/10/28/node-red-lecture-3-basic-nodes-and-flows/#h.5zaw60nvfsyj

//TODO audio stream output, status output

module.exports = function(RED) {
    function micropiNode(config) {

        RED.nodes.createNode(this, config);

        var name = config.name;
        var bitwidth = config.bitwidth;
        var channels = config.channels;
        var rate = config.rate;
        var filename = config.filename;
        var options = config;
        delete options.name;
        var timeout = (config.silence * 1000) || 5000;

        //options.debug forwards a string instead of boolean, so we need to convert...
        if (options.debug === "true") {
            options.debug = true;
        } else {
            options.debug = false;
        }

        const node = this;
        const Mic = require('./lib/mic');
        const mic = new Mic(options);
        
        const fs = require('fs');
		const wav = require('wav');
        
        let audioStream = undefined;
        var outputFileStream;

        //define state recording and set it to node
        const nodeStatusRecording = {fill: "red", shape: "ring", text: "recording"};
        const nodeStatusPaused = {fill: "red", shape: "dot", text: "paused"};
        const nodeStatusSilence = {fill: "green", shape: "dot", text: "silence.."};

        this.on('input', (msgIn) => {
            //it's important to know that javascript will make a conversion to boolean for msg.payload
            //e.g. "true" becomes true, "false" becomes true and so on
            //this can lead to unexpected behaviour
            if (msgIn.payload === true) {
                timeout = msgIn.silence || timeout; //if msgIn.silence exists set it to timeout, else leave timeout from the editpanel
                this.startRecord(timeout);
            } else if(msgIn.payload === false){
                this.stopRecord();
            }
        });

        this.startRecord = function(timeout) {
            outputFileStream = new wav.FileWriter(filename, {						channels: this.channels,
                    sampleRate: this.rate,
                    bitDepth: this.bitwidth
                });
            outputFileStream.write(audioStream);
            mic.start(node, timeout);
        }

        //new stream was set up and is now available for binding events
        node.on('streamAvailable', (_audioStream) => {
            audioStream = _audioStream;

            audioStream.on('startComplete', () => {
                node.send({status: 'startRecording', payload: '', meta: options});
                node.status(nodeStatusRecording);
            });

            audioStream.on('stopComplete', () => {
                outputFileStream.end();
                node.send({status: 'stopRecording', payload: '', meta: options});
                node.status({});
            });

            audioStream.on('silence', () => {
                console.log('event silence in microphone');
                node.send({status: 'silence', payload: ''});
                node.status(nodeStatusSilence);
            });

            audioStream.on('resumed', () => {
                node.send({status: 'resumeRecording', payload: ''});
                node.status(nodeStatusRecording);
            });

            audioStream.on('debug', (message) => {
                if (options.debug) {
                    node.warn(message);
                }
            });

            audioStream.on('data', (data) => {
                if(!audioStream.isSilenced()) {
                    node.send({status: 'data', payload: data, meta: options});
                }
            });

        });

        this.stopRecord = function (){
            mic.stop();
        }

    }
    RED.nodes.registerType('microPi', micropiNode);
}
