# Rendimiento

La versión 1.3.6 observa cambios del DOM y eventos de edición para continuar cuando se cumple cada condición, sin esperar siempre al siguiente sondeo. Conserva un temporizador de respaldo de 100 ms. Cada espera libera sus observadores, listeners y temporizadores al terminar. No depende de requestAnimationFrame.

Las ventanas de estabilidad pasan a 60 ms, con una comprobación final de 80 ms. Si Extra High ya está seleccionado, no vuelve a abrir ni estabilizar el selector. Un pegado que ya produjo el texto esperado tampoco añade una pausa fija. Para un editor vacío, el margen inicial para el rellenado nativo pasa de 1.500 a 250 ms.

Se mantienen los límites máximos de espera para carga, selección y confirmación. Un control lento, un borrador distinto o un esfuerzo no confirmado no se saltan para ganar velocidad. El diagnóstico local registra los milisegundos hasta el clic de envío.

## Comparación reproducible

Resultados con el mismo DOM y reloj simulados, sin red ni una sesión real de ChatGPT:

| Escenario | v1.3.5 | v1.3.6 |
| --- | ---: | ---: |
| Texto y Extra High ya preparados | 1.900 ms | 260 ms |
| Editor vacío, Extra High preparado, pegado síncrono | 3.850 ms | 510 ms |
| Texto preparado, cambio Pro → Extra High con teclado de respaldo | 4.050 ms | 1.740 ms |

Son pausas impuestas por el script en estos escenarios, no tiempos garantizados desde que se abre la web ni mejoras de la velocidad de respuesta del modelo. La prueba del deslizador conserva un intento sin respuesta antes de usar su control interno.

```sh
node scripts/benchmark.cjs
```

Para comparar otra versión, la variable de entorno `SCRIPT_UNDER_TEST` acepta la ruta local a su userscript. El archivo de prueba no se abre en un navegador: se ejecuta en el mismo entorno simulado.

## Comprobaciones

Las pruebas cubren las rutas rápidas, pegado asíncrono y rechazado, rellenado nativo, controles lentos, cambios de texto antes del envío, notificaciones solo ante alertas y protección de envío único. También comprueban el despertar por cambios DOM, reinicio de la estabilidad cuando un estado se revierte, timeouts y liberación de observadores, temporizadores y listeners.

No son pruebas de integración con una cuenta real. Los tiempos reales dependen de la página, el navegador, la conexión y los controles disponibles.
