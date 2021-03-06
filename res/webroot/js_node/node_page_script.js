const serverURL = 'ws://localhost:8081';
const PERIOD = Math.random()*3000 + 5000;
//const serverURL = 'ws://1104-5-170-128-165.ngrok.io'
let webSocket;

let node;

let connectionsManager;
let rilevations;

window.onload = function(){
    webSocket = new WebSocket(serverURL);
    setUpSocket(webSocket);
    connectionsManager = new WebrtcManager(webSocket);
    rilevations = setInterval(sensorsRilevation, PERIOD);
}

window.onbeforeunload = function(){
    connectionsManager.sendMsgToConnectedNodes(JSON.stringify({"type": "close_connection"}));
};


function setUpSocket(webSocket){
	webSocket.onopen = () => {
        console.log('open');
        //ask for node setup
        webSocket.send(JSON.stringify({"type": "node_setup_demand"}));
    }

	webSocket.onclose = () => console.log('close');
	webSocket.onerror = (error) => console.log('error', error.message);

	webSocket.onmessage = function(msg) {
		console.log('New message: ', msg.data);
        try{
			let json = JSON.parse(msg.data);
			if(json.type != null){
                switch(json.type){
                    case "node_setup":
                        if(node == null){
                            node = new GenericNode(json.id, json.node_configuration, webSocket, connectionsManager);
                            connectionsManager.setStrategy(new ChannelStrategy(node));
                            connectionsManager.setLocalNodeId(node.id);
                            node.sendNodeConfiguration();
                            node.setNewCoordinates(json.x, json.y);
                        }else{
                            console.error("Can't create a new node, because it is already exists");
                        }
                        break;
                    case "notify_state":
                        node.notifyState();
                        break;
                    case "move_node":
                        json.id == node.id ? node.setNewCoordinates(json.x, json.y) : console.error("Wrong id");
                        break;
                    case "disconnect_node":
                        json.id == node.id ? window.close() : console.error("Wrong id");
                        break;
                    case "change_node_state":
                        changeNodeState(json);
                        break;
                    case "connection_available":
                        connectionsManager.connectionAvailable(json.to_be_connected);
                        break;
                    case "stop_sersors_rilevation":
                        clearInterval(this.rilevations);
                        break;
                    case "signaling":
                        connectionsManager.elaborateMsg(json);
                        break;
                    default:
                        console.error("Incorrect message type", json);
                }
            }else{
                console.error("Message unrecognized", json);
            } 
		}catch(err){
			console.error(err);
		}
	};
}

function changeNodeState(json){
    if(json.id == node.id){
        let device_name;
        if(json.device_type === "sensor"){
            device_name = json.sensor_name;
        }else if(json.device_type === "actuator"){
            device_name = json.actuator_name;
        }else{
            console.error("Unknown mode for change the node's state", json.device_type);
        }
        node.setValue(json.value, device_name);
    }else{
        console.error("Wrong id", json.id);
    }
}

function sensorsRilevation(){
    if (typeof node !== 'undefined') {
        let sensors = node.getSensors();
        if(sensors.length > 0){
            let sensor = sensors[Math.floor(Math.random() * sensors.length)];
            let plusOrMinus = Math.random() < 0.5 ? -1 : 1;
            switch(sensor.getValueType()){
                case "real":
                    node.setValue(sensor.getValue() + Math.random()*plusOrMinus, sensor.sensor_name);
                    break;
                case "integer":
                    node.setValue(sensor.getValue() + plusOrMinus, sensor.sensor_name);
                    break;
                case "natural":
                    if(sensor.getValue() + plusOrMinus < 0){
                        node.setValue(sensor.getValue() + 1, sensor.sensor_name);
                    }else{
                        node.setValue(sensor.getValue() + plusOrMinus, sensor.sensor_name);
                    }
                    break;
                case "boolean":
                    node.setValue(!sensor.getValue(), sensor.sensor_name);
                    break;
                default:
                    console.error("Type of sensor value was not recognized");
            }  
        }       
    }
}
