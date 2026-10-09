# Rendimiento

## Versión 1.3.7

Mantiene las esperas por eventos de la versión 1.3.6, con sondeo de respaldo de 100 ms y los mismos límites máximos. No depende de requestAnimationFrame, no aumenta la frecuencia de sondeo y conserva la limpieza de observadores, listeners y temporizadores.

La preparación ya no encadena tres pausas de 60 ms para comprobar repetidamente un editor que está listo. Comprueba el texto inmediatamente y conserva una única ventana final de **80 ms** en la que deben coincidir editor, esfuerzo Extra High, menú cerrado y botón Enviar habilitado. No se ha acortado esa ventana final. Si React sustituye el editor, el selector o el botón, la ventana vuelve a empezar aunque se mantenga su contenido.

Cuando necesita cambiar Power, prueba primero el thumb interno con eventos que pueden propagarse a sus ancestros, en lugar de gastar primero hasta 1.300 ms en una fila sin un manejador eficaz. Conserva la fila, el root y el callback como rutas de respaldo. La mejora del deslizador depende de qué control responda en cada interfaz: no se garantiza que todas las variantes sean más rápidas.

Se conserva el margen de 250 ms para el rellenado nativo cuando el editor está vacío, así como los plazos máximos para pegado, selección, carga y confirmación. Una consulta distinta, un borrador diferente o un esfuerzo no confirmado sigue impidiendo el envío. El panel aparece solo ante alertas. El registro local incluye el tiempo de preparación hasta el clic.

## Comparación reproducible

Resultados obtenidos con **el mismo DOM y reloj simulados**, sin red ni una sesión real de ChatGPT. Miden pausas impuestas por el script, no la carga del sitio ni la velocidad de respuesta del modelo.

| Escenario | v1.3.5 | v1.3.6 | v1.3.7 |
| --- | ---: | ---: | ---: |
| Texto y Extra High ya preparados | 1.900 ms | 260 ms | 80 ms |
| Editor vacío, Extra High preparado, pegado síncrono | 3.850 ms | 510 ms | 330 ms |
| Texto preparado, Pro → Extra High, manejador en el control interno | 4.050 ms | 1.740 ms | 260 ms |

Respecto a 1.3.6, estas simulaciones reducen las pausas un 69 %, 35 % y 85 %, respectivamente. En la tercera, la fila exterior no responde directamente y el thumb sí: por eso desaparece un intento de 1.300 ms sin respuesta. Otras variantes pueden necesitar rutas de respaldo.

```sh
node scripts/benchmark.cjs
```

Para comparar otra versión, `SCRIPT_UNDER_TEST` acepta la ruta local a su userscript. Por ejemplo, después de guardar el archivo de una versión anterior:

```sh
SCRIPT_UNDER_TEST=/tmp/previous.user.js node scripts/benchmark.cjs
```

El archivo se ejecuta en el entorno de pruebas, no en un navegador. Los tiempos reales dependen de cuándo la web esté lista, de la carga del navegador y de los controles disponibles.

## Comprobaciones

```sh
node --test
node --check chatgpt-extra-high.user.js
node scripts/sync-distribution.cjs --check
```

Las 83 pruebas de esta versión cubren pegado asíncrono y rechazado, rellenado nativo, controles lentos, cambios de texto/esfuerzo antes del envío, reemplazos de elementos, menú abierto, alertas y envío único. También comprueban el despertar por cambios DOM, reinicio de estabilidad, timeouts y liberación de observadores, temporizadores y listeners. Son pruebas simuladas, no una certificación de integración con ChatGPT.
