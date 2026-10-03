require("dotenv").config();

const path = require("path");
const express = require("express");
const mqtt = require("mqtt");

const app = express();
const port = Number(process.env.PORT || 3000);
const mqttUrl = process.env.MQTT_URL || "mqtt://test.mosquitto.org:1883";
const mqttOfflineAfterMs = Number(process.env.MQTT_OFFLINE_AFTER_MS || 15000);

function getTopicBase(roomNumber) {
  const suffix = String(roomNumber).padStart(2, "0");
  const variableName = `MQTT_TOPIC_BASE_${suffix}`;
  const defaultTopic = `universidad/demo/aula-energia-${suffix}`;
  const fallbackTopic = roomNumber === 1 ? process.env.MQTT_TOPIC_BASE : undefined;
  return (process.env[variableName] || fallbackTopic || defaultTopic).replace(/\/$/, "");
}

const roomDefinitions = Array.from({ length: 6 }, (_value, index) => {
  const roomNumber = index + 1;
  const suffix = String(roomNumber).padStart(2, "0");
  return {
    id: `aula-${suffix}`,
    name: `Aula ${suffix}`,
    topicBase: getTopicBase(roomNumber)
  };
});

const liveRooms = roomDefinitions.map((room) => ({
  id: room.id,
  name: room.name,
  mode: "mqtt-real",
  topicBase: room.topicBase,
  presencia: null,
  iluminacion: null,
  lampara: null,
  lastUpdated: null,
  messagesReceived: 0
}));

const brokerStatus = {
  connected: false,
  lastError: null,
  lastConnectedAt: null
};

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "encendida", "encendido", "on"].includes(normalized)) return true;
  if (["0", "false", "apagada", "apagado", "off"].includes(normalized)) return false;
  return null;
}

function toIllumination(value) {
  if (typeof value === "boolean") return value ? "oscuro" : "suficiente";

  const normalized = String(value).trim().toLowerCase();
  if (["oscuro", "oscuridad", "dark", "1", "true"].includes(normalized)) return "oscuro";
  if (["suficiente", "claro", "luz natural", "0", "false"].includes(normalized)) return "suficiente";
  return null;
}

function markLiveUpdate(room) {
  room.lastUpdated = new Date().toISOString();
  room.messagesReceived += 1;
}

function isRoomOnline(room) {
  if (!room.lastUpdated) return false;

  const elapsedMs = Date.now() - Date.parse(room.lastUpdated);
  return elapsedMs >= 0 && elapsedMs <= mqttOfflineAfterMs;
}

function updateFromState(room, payload) {
  let state;

  try {
    state = JSON.parse(payload);
  } catch {
    return false;
  }

  const presence = toBoolean(state.presencia);
  const illumination = toIllumination(state.iluminacion ?? state.ambiente_oscuro);
  const lamp = toBoolean(state.lampara);

  if (presence !== null) room.presencia = presence;
  if (illumination !== null) room.iluminacion = illumination;
  if (lamp !== null) room.lampara = lamp;
  markLiveUpdate(room);
  return true;
}

function handleMqttMessage(topic, messageBuffer) {
  const payload = messageBuffer.toString().trim();
  const definition = roomDefinitions.find((room) => topic.startsWith(room.topicBase + "/"));
  if (!definition) return;

  const room = liveRooms.find((item) => item.id === definition.id);
  const suffix = topic.slice(definition.topicBase.length + 1);
  let wasHandled = false;

  if (suffix === "estado") {
    wasHandled = updateFromState(room, payload);
  } else if (suffix === "presencia") {
    const presence = toBoolean(payload);
    if (presence !== null) {
      room.presencia = presence;
      wasHandled = true;
    }
  } else if (suffix === "iluminacion") {
    const illumination = toIllumination(payload);
    if (illumination !== null) {
      room.iluminacion = illumination;
      wasHandled = true;
    }
  } else if (suffix === "lampara") {
    const lamp = toBoolean(payload);
    if (lamp !== null) {
      room.lampara = lamp;
      wasHandled = true;
    }
  }

  if (wasHandled && suffix !== "estado") markLiveUpdate(room);
}

const mqttClient = mqtt.connect(mqttUrl, {
  clientId: `panel-aulas-${Math.random().toString(16).slice(2, 10)}`,
  reconnectPeriod: 5000,
  connectTimeout: 10000
});

mqttClient.on("connect", () => {
  brokerStatus.connected = true;
  brokerStatus.lastError = null;
  brokerStatus.lastConnectedAt = new Date().toISOString();

  const subscriptions = roomDefinitions.map((room) => room.topicBase + "/#");
  mqttClient.subscribe(subscriptions, { qos: 0 }, (error) => {
    if (error) {
      brokerStatus.lastError = `No se pudo suscribir: ${error.message}`;
      console.error(brokerStatus.lastError);
      return;
    }

    console.log("Suscrito a: " + subscriptions.join(", "));
  });
});

mqttClient.on("reconnect", () => {
  brokerStatus.connected = false;
  console.log("Reconectando al broker MQTT...");
});

mqttClient.on("offline", () => {
  brokerStatus.connected = false;
});

mqttClient.on("error", (error) => {
  brokerStatus.connected = false;
  brokerStatus.lastError = error.message;
  console.error(`Error MQTT: ${error.message}`);
});

mqttClient.on("message", handleMqttMessage);

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/aulas", (_request, response) => {
  response.json({
    generatedAt: new Date().toISOString(),
    mqtt: {
      connected: brokerStatus.connected,
      topicBases: roomDefinitions.map((room) => room.topicBase),
      lastError: brokerStatus.lastError
    },
    aulas: liveRooms.map((room) => ({
      ...room,
      online: isRoomOnline(room)
    }))
  });
});

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok", mqttConnected: brokerStatus.connected });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Panel disponible en http://localhost:${port}`);
});

function shutdown() {
  mqttClient.end(true, () => server.close(() => process.exit(0)));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
