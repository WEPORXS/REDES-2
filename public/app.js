const roomsElement = document.querySelector("#rooms");
const template = document.querySelector("#room-template");
const errorElement = document.querySelector("#error-message");
const connectionDot = document.querySelector("#connection-dot");
const connectionLabel = document.querySelector("#connection-label");
const connectionDetail = document.querySelector("#connection-detail");
const lastRefresh = document.querySelector("#last-refresh");

function formatTime(value) {
  if (!value) return "Sin telemetría";
  if (value === "Datos simulados") return value;
  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function presenceLabel(value) {
  if (value === null || value === undefined) return "Sin dato";
  return value ? "Detectada" : "No detectada";
}

function lightLabel(value) {
  if (!value) return "Sin dato";
  return value === "oscuro" ? "Oscura" : "Suficiente";
}

function lampLabel(value) {
  if (value === null || value === undefined) return "Sin dato";
  return value ? "Encendida" : "Apagada";
}

function renderRoom(room) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".room-card");
  const isLive = room.mode === "mqtt-real";
  const isOnline = isLive && room.online === true;

  card.classList.toggle("is-live", isLive);
  //card.querySelector(".room-mode").textContent = isLive ? "MQTT REAL" : "SIMULADA";
  card.querySelector(".room-name").textContent = room.name;
  card.querySelector(".presence-value").textContent = presenceLabel(room.presencia);
  card.querySelector(".light-value").textContent = lightLabel(room.iluminacion);
  card.querySelector(".lamp-value").textContent = lampLabel(room.lampara);
  card.querySelector(".updated-value").textContent = formatTime(room.lastUpdated);

  const status = card.querySelector(".room-status");
  status.textContent = isLive ? (isOnline ? "En línea" : "Fuera de línea") : "Demo";
  status.classList.add(isOnline ? "online" : isLive ? "offline" : "demo");
  return fragment;
}

function updateConnection(mqtt) {
  connectionDot.classList.toggle("connected", mqtt.connected);
  connectionLabel.textContent = mqtt.connected ? "Broker MQTT conectado" : "Sin conexión con el broker MQTT";
  //connectionDetail.textContent = mqtt.connected
    //? (mqtt.topicBases || []).join(" · ")
    //: (mqtt.lastError || "Se intentará reconectar automáticamente.");
}

async function refreshPanel() {
  try {
    const response = await fetch("/api/aulas", { cache: "no-store" });
    if (!response.ok) throw new Error("No fue posible obtener el estado de las aulas.");

    const data = await response.json();
    roomsElement.replaceChildren(...data.aulas.map(renderRoom));
    updateConnection(data.mqtt);
    errorElement.textContent = "";
    //lastRefresh.textContent = `Panel actualizado: ${formatTime(data.generatedAt)}`;
  } catch (error) {
    errorElement.textContent = "No se pudo actualizar el panel. Se reintentará automáticamente.";
    connectionDot.classList.remove("connected");
    connectionLabel.textContent = "Panel temporalmente no disponible";
    connectionDetail.textContent = error.message;
  }
}

refreshPanel();
window.setInterval(refreshPanel, 5000);
