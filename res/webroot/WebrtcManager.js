/**
 * Manage all webRTC connections
 */
class WebrtcManager{
	// if true, after finishing handshake, create a new connection
	#connectionAvailable = false;
	// Array with all connected peers
	#peers = []

	#connection_id = 0;
	
	constructor(webSocket){
		this.webSocket = webSocket;
	}

	setStrategy(channelStrategy){
		this.channelStrategy = channelStrategy;
	}

	//Start a new connection with an peer
	#addConnection(){
		this.#peers.push(new ConnectedPeer(this.#connection_id++, this.channelStrategy, this.webSocket)); 
		this.#getLastPeer().createNewChannel();
	}

	// send a msg to all peers
	sendMsgToConnectedNodes(msg){
		for(let i = 0; i < this.#peers.length; i++){
			console.log("State: " ,this.#peers[i].getConnection().iceConnectionState);
			if(this.#peers[i].getConnection().iceConnectionState === 'disconnected' 
				|| this.#peers[i].channel.readyState !== 'open'){
				//if a peer is disconnected, remove it from array
				// probably is needed more stable way to do it 
				console.log("remove a connection");
				this.#peers.splice(i,1);
			}else{
				//send msg
				this.#peers[i].channel.send(msg);
			}
		}
	}

	// if a new msg is received
	async elaborateMsg(json){
		if(json.desc){
			if (json.desc.type === 'offer') { // receive an handshake offer from another peer
				this.#peers.push(new ConnectedPeer(this.#connection_id++, this.channelStrategy, this.webSocket)); 
				await this.#getLastPeer().getConnection().setRemoteDescription(json.desc);
				await this.#getLastPeer().getConnection().setLocalDescription(await this.#getLastPeer().getConnection().createAnswer());
				this.webSocket.send(JSON.stringify({desc: this.#getLastPeer().getConnection().localDescription}));
			} else if (json.desc.type === 'answer') { // receive an handshake answer from another peer
				await this.#getLastPeer().getConnection().setRemoteDescription(json.desc);
			} else {
				console.log('Unsupported SDP type.');
			}

		}else if(json.candidate){ // receive an ice candidate from another peer
			console.log("received candidate: ");
			await this.#getLastPeer().getConnection().addIceCandidate(json);
		}else{
			console.log("The received msg is not recognized: ", json);
		}
	}

	//If there is a peer that must be connected so start a new connection, if it can't be done right now, so set the flag #connectionAvailable
	connectionAvailable(){
		console.log("last peer connection state",  this.#getLastPeer() ? this.#getLastPeer().getConnection().iceConnectionState : null);
		if(!this.#getLastPeer()){
			this.#addConnection()

		}else if(this.#getLastPeer().getConnection().iceConnectionState === "connected"){
			this.#addConnection()
		}else{
			this.#connectionAvailable = true;
		}
	}

	// return a last added peer
	#getLastPeer(){
		return this.#peers[this.#peers.length -1];
	}

	//An peer use this method for notify WebrtcManager about completion of the connection precess
	notifyConnectionComplete(){
		if(this.#connectionAvailable){
			console.log("Another connections are available so go to add them");
			this.#addConnection();
			this.#connectionAvailable = false;
		}
	}
}

/**
 * A class that incapsulate a single connection with an peer
 */
class ConnectedPeer{
	static STUN_SERVER_URL = 'stun:stun.l.google.com:19302';
	constructor(id, strategy, serverWebSocket){
		this.serverWebSocket = serverWebSocket;
		this.strategy = strategy;
		this.id = id;
		
		let configuration = {iceServers: [{urls: ConnectedPeer.STUN_SERVER_URL}]};
		this.peerConnection =  new RTCPeerConnection(configuration);
		this.peerConnection.ondatachannel = (event) =>  this.#setUpChannel(event.channel);
		this.peerConnection.oniceconnectionstatechange = (e) => {
			if(this.peerConnection.iceConnectionState == 'disconnected'){
				this.strategy.onDisconnected(this.channel, this.#getChannelId());
			}
		};
	}
	
	//Create a new channel
	createNewChannel(){
		this.#setUpChannel(this.peerConnection.createDataChannel("Channel" + this.#getChannelId()));

		// Send any ice candidates to the other peer.
		this.peerConnection.onicecandidate = e => {if(e.candidate != null) this.serverWebSocket.send(JSON.stringify(e.candidate))}

		// Let the "negotiationneeded" event trigger offer generation.
		this.peerConnection.onnegotiationneeded = async () => {
			try {
				await this.peerConnection.setLocalDescription(await this.peerConnection.createOffer());
				// Send the offer to the other peer.
				let obj = {desc: this.peerConnection.localDescription};
				this.serverWebSocket.send(JSON.stringify(obj));
			} catch (err) {
				console.error(err);
			}
		};
	}

	getConnection(){
		return this.peerConnection;
	}

	#setUpChannel(newChannel) {
		this.channel = newChannel;
		console.log("my channel id: " + this.#getChannelId() + "|  my global id: "  + this.#getChannelId());
		
		this.channel.onopen = () => this.strategy.onOpen(this.channel, this.#getChannelId());
		this.channel.onmessage = (m) => this.strategy.onMessage(m, this.channel , this.#getChannelId());
		this.channel.onclose = () => this.strategy.onClose(this.channel , this.#getChannelId()); 

		this.channel.onerror = function(event) {
			console.error(
			  'Network Error. The error "' + event.error + '" occurred while handling player control network messages. ' + "\n" +
			  event.filename +  "\n" +
			  event.lineno +  "\n" +
			  event.colno +  "\n" + "Event : "+ event
			);
		  }

		//   this.channel.onclose = ev => {
		// 	this.peerConnection.close();
		//   }
	}

	#getChannelId(){
		return this.id;
	}
}
