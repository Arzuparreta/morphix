![Morphix Logo Banner](docs/branding/morphix_logo_banner.png)

# 🎨 Morphix Restyle

**Restyle any website in seconds with a single prompt.**

Soy **Arzuparreta**, músico apasionado por la tecnología y administrador de sistemas Linux. Morphix nació de una necesidad real: como alguien que pasa horas frente a pantallas configurando servidores, escribiendo código y creando música, necesitaba una forma rápida de adaptar la web a mi flujo de trabajo, sin perder tiempo editando CSS manualmente.

Con Morphix, simplemente abres la extensión, describes el cambio visual que quieres, y la IA genera el CSS/JavaScript necesario al instante. Es la unión perfecta entre **automatización de sistemas**, **inteligencia artificial** y **sentido estético musical**.

## ✨ Qué hace

- **Restyling por prompts**: Cambia la apariencia de cualquier web usando lenguaje natural.
- **Contexto inteligente**: Extrae un resumen ligero de la página para que el modelo apunte a los elementos reales.
- **Inyección dinámica**: Inserta CSS y JavaScript opcional cuando el CSS no basta.
- **Revisión previa**: Visualiza los cambios antes de aplicarlos permanentemente.
- **Gestión de estilos**: Guarda tus restyles para una sesión, una URL específica, un dominio entero, o en tu biblioteca personal.
- **Múltiples proveedores IA**: Compatible con OpenRouter, Anthropic, OpenCode Go, Ollama y cualquier endpoint compatible con OpenAI.

## 🚀 Instalación local

Este repositorio no requiere compilación. Es software libre (Open Source) porque creo en la privacidad y en el control del usuario sobre sus herramientas.

1. Clona o descarga el repositorio.
2. Abre Chrome o cualquier navegador basado en Chromium.
3. Ve a `chrome://extensions`.
4. Activa el **Modo desarrollador**.
5. Haz clic en **Cargar descomprimido**.
6. Selecciona la carpeta `extension/` de este repositorio.

¡No olvides fijar **Morphix Restyle** en la barra de extensiones para acceso rápido!

## ⚙️ Configura tu proveedor de IA

1. Abre la página de opciones de la extensión.
2. Elige un proveedor de IA.
3. Introduce el modelo, la URL base, la API key y cualquier cabecera personalizada que requiera el proveedor.
4. Haz clic en **Test provider** para verificar la conexión.
5. Haz clic en **Save provider** para guardar.

La configuración por defecto es OpenRouter. Si usas proveedores locales como Ollama, puedes usarlo sin API key siempre que exponga un endpoint `/v1/chat/completions` compatible con OpenAI.

## 🎯 Cómo usarlo

1. Navega a cualquier web que quieras rediseñar.
2. Abre Morphix Restyle desde la barra de herramientas.
3. Escribe un prompt, por ejemplo:
   - `Make this page calmer and easier to read.`
   - `Increase contrast and make buttons more obvious.`
   - `Hide distracting sidebars and widen the main article.`
4. Haz clic en **Apply**.
5. Revisa el resultado.
6. Decide si mantenerlo para la sesión, la URL, el dominio o guardarlo en tu biblioteca.

Si el resultado no es el esperado, reintenta con el mismo prompt o descártalo y prueba uno más específico.

## 🛡️ Privacidad y Seguridad

Como **SysAdmin**, la seguridad es mi prioridad. Morphix almacena la configuración del proveedor y los estilos guardados en el almacenamiento local de la extensión de Chrome. Tus API keys y ajustes nunca salen de tu navegador.

Cuando haces clic en **Apply**, Morphix envía al proveedor de IA seleccionado:
- Tu prompt.
- La URL y título de la página actual.
- El tamaño de la ventana.
- Un resumen compacto de los elementos visibles de la página (etiquetas, identificadores estables, fragmentos de texto y posiciones).

**Por diseño**, Morphix no envía el HTML completo de la página. Puedes ver exactamente qué contexto se envía en cada borrador bajo **What we sent** en el popup.

## 🗂️ Estructura del proyecto

```text
extension/
  manifest.json                 Manifiesto de la extensión
  background/service-worker.js   Gestión de mensajes, llamadas al proveedor, inyección de estilos
  content/extract.js             Extracción de contexto visible de la página
  content/inject.js              Inyección de estilos/scripts en tiempo de ejecución y manejo de rutas
  options/                       UI de configuración de proveedores y biblioteca de estilos
  popup/                         UI de prompts, previsualización y gestión de estilos
  shared/                        Helpers para proveedores, prompts y almacenamiento
```

## 🌱 Estado del proyecto

Morphix Restyle es una extensión temprana en fase local. Es normal encontrar imperfecciones, especialmente en sitios con políticas de seguridad estrictas (CSP), uso intensivo de Shadow DOM o layouts muy dinámicos.

**Contribuciones y correcciones son bienvenidas**. Si te gusta la herramienta y quieres colaborar, ¡no dudes en abrir un issue o un pull request!

## 🎼 ¿Quién hay detrás?

Soy **Arzuparreta**, un músico que se metió en el mundo de los sistemas Linux y la automatización. Morphix es un reflejo de mi forma de trabajar: eficiente, creativa y un poco diferente a lo habitual.

- 🐧 **SysAdmin Linux**: Sé cómo mantener las cosas funcionando y seguras.
- 🎵 **Músico**: Entiendo la importancia de la estética y el ritmo visual.
- 🤖 **Builder IA**: Uso la IA para automatizar tareas sencillas y potenciar la creatividad.

Si te gusta mi trabajo, dale una ⭐ a este repo y sígueme para ver cómo construyo herramientas que mezclan estos mundos.

[![GitHub followers](https://img.shields.io/github/followers/Arzuparreta?label=Follow&style=social)](https://github.com/Arzuparreta)
[![Twitter Follow](https://img.shields.io/twitter/follow/Arzuparreta?style=social)](https://twitter.com/Arzuparreta)

---
*Construyendo en público - Linux, Música y Código.* 🚀
