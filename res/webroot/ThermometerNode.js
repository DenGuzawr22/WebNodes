//////////////////////////////////////////////////////
/* THIS CLASS IS NOT USED  and will be removed soon*/
/////////////////////////////////////////////////////

const LED_ON_CLASS = "led_on";

class ThermometerNode{
   
    constructor(id, x, y, radius, webSocket, webrtcManager){
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.temperature = 25;
        this.connectedNodes = new Map();
        this.webSocket = webSocket;
        this.webrtcManager = webrtcManager;
        
        document.title = "Thermometer " + this.id;
        document.getElementById("h1").innerHTML += " " + this.id;

        this.temperatureLabel = document.getElementById("t");
        this.xLabel = document.getElementById("xx");
        this.yLabel = document.getElementById("yy");
        this.ledLabel = document.getElementById("led");
        this.connectedNodesLable = document.getElementById("connected_nodes_id");

        this.setNewCoordinates(x,y);
        this.setTemperature(this.temperature);

        document.getElementById("node_container").style.visibility = "visible";

        this.#sendNodeConfiguration();
    }

    setTemperature(newTemperature){
        if(newTemperature > -100 && newTemperature < 100){
            this.temperature =  Math.round(newTemperature * 100) / 100;
            this.temperatureLabel.innerText = this.temperature;
            this.notifyState();
        }else{
            console.log("The new temperature is out of range");
        }
    }

    turnOnLed(turnOn){
        if(turnOn && !this.ledLabel.classList.contains(LED_ON_CLASS)){
            this.ledLabel.classList.add(LED_ON_CLASS);
        }else if(!turnOn && this.ledLabel.classList.contains(LED_ON_CLASS)){
            this.ledLabel.classList.remove(LED_ON_CLASS);
        }
    }

    getTemperature(){
        return this.temperature;
    }

    notifyState(){
        let obj = JSON.stringify(
            {"type": "node_state",
            "id": this.id, 
            "temperature": this.temperature, 
            "x": this.x, 
            "y": this.y,
            "led_on": this.ledLabel.classList.contains(LED_ON_CLASS),
            "connected_nodes_id": this.#getArrayWithConnectedNodesId()
            });
        webSocket.send(obj);
    }

    setNewCoordinates(x, y){
        this.x = x;
        this.y = y;
        this.xLabel.innerText = x;
        this.yLabel.innerText = y;
        this.webrtcManager.sendToAll(JSON.stringify({"type": "movementTo", "x": this.x, "y": this.y}));
        this.notifyState();
    }

    addConnectedNode(channelId, nodeId){
        this.connectedNodes.set(channelId, nodeId);
        this.notifyState();
        this.#updateConnectedNodeslabel();
    }

    removeConnectedNode(channelId){
        this.connectedNodes.delete(channelId);
        this.notifyState();
        this.#updateConnectedNodeslabel();
    }

    //return true if a point with coordinates (nodeX; nodeY) is outside of radius of node
    isOutOfRadius(nodeX ,nodeY){
        return Math.hypot(this.x-nodeX, this.y-nodeY) > this.radius;
    }

    // Update web page
    #updateConnectedNodeslabel(){
        this.connectedNodesLable.innerText = this.#getArrayWithConnectedNodesId(); 
    }

    // return an array with id of the connected nodes
    #getArrayWithConnectedNodesId(){
        let arr = [];
        let it = this.connectedNodes.values();

        let result = it.next();
        while (!result.done) {
            arr.push(result.value);
            result = it.next();
        }
        return arr;
    }

    //Send Node configuration to server
    #sendNodeConfiguration(){
        let obj = {
            "type": "node_configuration",
            "id": this.id,
            "sensors": [
                {"sensor_name": "thermometer",
                "value_name": "temperature",
                "value_type": "real"}
            ],
            "actuators": [
                {"actuator_name": "led",
                "value_name": "turn_on",
                "value_type": "boolean"}
            ],
            
        };
        this.webSocket.send(JSON.stringify(obj));
    }
}