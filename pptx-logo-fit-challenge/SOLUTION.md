# Ajuste de Logo en PPTX - Solución

## Enfoque

La solución elegida utiliza el enfoque de **"Un solo placeholder + contención programática (redimensionamiento de offset/ext)"**. En lugar de modificar la plantilla de PowerPoint para tener tres placeholders diferentes, modificamos dinámicamente las dimensiones del marco de la imagen directamente en el XML de la presentación (`slide1.xml`). De esta manera, aplicamos lógica matemática para que la imagen se ajuste ("contain") perfectamente sin alterar su relación de aspecto.

Este enfoque fue elegido porque permite que la plantilla se mantenga simple (un solo placeholder) mientras maneja de forma robusta y programática cualquier relación de aspecto que tenga el logo entrante. Es un patrón de ingeniería sólido y escalable.

## Cómo Funciona

1. **Análisis del XML y Búsqueda de la Imagen:** 
   El script descomprime el archivo `.pptx` y analiza el documento `ppt/slides/slide1.xml` para encontrar el bloque `<p:pic>` que contiene el texto alternativo o marcador objetivo (`d.unifiedLogo`).

2. **Lectura de las Dimensiones Reales:** 
   Utilizando la librería `image-size`, extraemos el `width` (ancho) y `height` (alto) exactos (en píxeles) del archivo PNG de reemplazo.

3. **Extracción de los Límites Originales del Marco:** 
   Usando expresiones regulares, extraemos las dimensiones originales del placeholder (`cx`, `cy`) de la etiqueta `<a:ext>` y su posición en la diapositiva (`x`, `y`) de la etiqueta `<a:off>`. Es crucial tener en cuenta que PowerPoint almacena estos valores en **EMU (English Metric Units)**, no en píxeles.
   *Nota técnica:* Las expresiones regulares fueron diseñadas específicamente para buscar las etiquetas que contienen los atributos `cx` y `x` (ej: `/<a:ext\s+([^>]*?cx=["']-?\d+["'][^>]*?)>/`). Esto soluciona un bug común al trabajar con plantillas reales, las cuales a menudo inyectan etiquetas de metadatos adicionales (como `<a:extLst>`) que pueden interrumpir la extracción de las coordenadas si la búsqueda es demasiado general.

4. **Cálculo de la Escala de Contención (Contain):** 
   Para ajustar la nueva imagen dentro de la caja limitante original conservando su relación de aspecto, calculamos un factor de escala:
   ```javascript
   const scale = Math.min(origCx / imgDims.width, origCy / imgDims.height);
   ```
   Debido a que `origCx` y `origCy` están en EMU y `imgDims` en píxeles, este valor de `scale` actúa de forma natural como un multiplicador de conversión de `EMU-por-píxel`.

5. **Cálculo de las Nuevas Dimensiones y Centrado:**
   Calculamos los nuevos `cx` y `cy` (en EMU) multiplicando las dimensiones en píxeles de la imagen por nuestra escala. Luego, calculamos los nuevos offsets `x` e `y` para asegurar que el marco recién redimensionado quede perfectamente centrado dentro del espacio del placeholder original:
   ```javascript
   const newCx = Math.round(imgDims.width * scale);
   const newCy = Math.round(imgDims.height * scale);
   const newX = origX + Math.round((origCx - newCx) / 2);
   const newY = origY + Math.round((origCy - newCy) / 2);
   ```

6. **Reescritura del XML y Empaquetado:**
   Finalmente, el script reemplaza los valores antiguos de `cx`, `cy`, `x` e `y` en el bloque `<p:pic>` por los nuevos valores calculados. Se inyecta el nuevo binario de la imagen, se vuelve a empaquetar el archivo ZIP y se genera el `.pptx` final listo para la marca.

Al ajustar los atributos XML del marco directamente a nivel de código, PowerPoint renderiza el logo perfectamente escalado y sin ningún tipo de deformación o estiramiento.
