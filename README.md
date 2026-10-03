# Panel MQTT de aulas

Panel web académico para demostrar el monitoreo energético de seis aulas. Todas las aulas están preparadas para recibir mensajes MQTT reales.

## Ejecutar localmente

Requiere Node.js 20 o superior.

```powershell
cd C:\ruta\a\panel-mqtt-aulas
npm install
npm start
```

Abre `http://localhost:3000`.

Las conexiones MQTT predeterminadas son:

```text
Broker: test.mosquitto.org:1883
Temas configurados:

- `universidad/demo/aula-energia-01/#`
- `universidad/demo/aula-energia-02/#`
- `universidad/demo/aula-energia-03/#`
- `universidad/demo/aula-energia-04/#`
- `universidad/demo/aula-energia-05/#`
- `universidad/demo/aula-energia-06/#`
```

Para modificarla, crea un archivo `.env` tomando como referencia `.env.example`, o define las variables de entorno antes de iniciar la aplicación.

## Mensajes compatibles

- `.../estado`: JSON, por ejemplo `{"presencia":true,"ambiente_oscuro":true,"lampara":true}`.
- `.../presencia`: `1` o `0`.
- `.../iluminacion`: `oscuro` o `suficiente`.
- `.../lampara`: `encendida` o `apagada`.

## Desplegar en Koyeb

1. Sube esta carpeta a un repositorio de GitHub.
2. En Koyeb, crea un **Web Service** desde ese repositorio.
3. Selecciona Node.js y configura:
   - Build command: `npm install`
   - Run command: `npm start`
   - Health check path: `/health`
4. Añade las variables de entorno:
   - `MQTT_URL=mqtt://test.mosquitto.org:1883`
   - `MQTT_TOPIC_BASE_01=universidad/demo/aula-energia-01`
   - `MQTT_TOPIC_BASE_02=universidad/demo/aula-energia-02`
   - `MQTT_TOPIC_BASE_03=universidad/demo/aula-energia-03`
   - `MQTT_TOPIC_BASE_04=universidad/demo/aula-energia-04`
- `MQTT_TOPIC_BASE_05=universidad/demo/aula-energia-05`
- `MQTT_TOPIC_BASE_06=universidad/demo/aula-energia-06`

El panel considera un aula en línea mientras recibe telemetría dentro del intervalo `MQTT_OFFLINE_AFTER_MS` (15 segundos por defecto). Si Wokwi se detiene o el ESP32 deja de publicar, la tarjeta cambia a `Fuera de línea`.
5. Despliega y abre la URL pública que entrega Koyeb.

El plan gratuito se puede suspender al no recibir visitas. Durante la demostración, deja el panel abierto; el navegador consulta el estado cada cinco segundos.

## Alcance y seguridad

Este proyecto es demostrativo. `test.mosquitto.org` es un broker público: no publiques datos personales, contraseñas ni información institucional. Para una implementación real, utiliza un broker privado, TLS y credenciales por dispositivo.
