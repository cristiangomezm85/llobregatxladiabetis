# Admin Llobregat

## Arranque recomendado en local

Ahora `npm run dev` usa un servidor local ligero propio, no Netlify CLI. Sirve la web estática y la API `/api/admin-content` en `http://localhost:8888`, por lo que puedes crear/editar/borrar contenido sin depender de Netlify, Forms ni GitHub.

```bash
npm run dev
```

Abre `http://localhost:8888/admin/`.

Si quieres probar Netlify CLI igualmente, usa `npm run netlify:dev`.

Se ha añadido un panel en `/admin/` para crear, editar, aprobar y eliminar contenido basado en JSON.

## Probar en local

```bash
npm run dev
```

Abre:

```text
http://localhost:8888/admin/
```

En local, el admin guarda directamente en:

```text
herois.json
pobles.json
patrocinadors.json
admin/solicitudes-herois.json
img/herois/
img/pobles/
img/patrocinadors/
```

No necesitas Netlify Forms, GitHub ni una base de datos para probar el flujo.

## Qué permite ahora

- Crear héroes manualmente.
- Editar héroes existentes.
- Eliminar héroes del JSON.
- Subir una foto para el héroe, convertida a WebP en el navegador.
- Marcar héroes como `publicat` o `borrador`.
- Crear una solicitud demo local y convertirla en héroe para probar el flujo de aprobación.
- Crear, editar y eliminar pueblos/puntos del recorrido.
- Crear, editar y eliminar patrocinadores.

Los elementos con `estat_publicacio: "borrador"` quedan ocultos en las páginas públicas de héroes/patrocinadores.

## Producción con Netlify + GitHub

En Netlify puedes usar el mismo admin para crear commits en GitHub. Define estas variables de entorno:

```text
CONTENT_BACKEND=github
GITHUB_REPO=usuario/repositorio
GITHUB_BRANCH=main
GITHUB_TOKEN=token_con_permiso_contents_write
ADMIN_TOKEN=un_token_largo_para_el_admin
```

Luego entra en `/admin/`, abre “Configuración” y guarda el mismo `ADMIN_TOKEN` en el navegador.

Cada guardado hará commit sobre los JSON/imágenes. Netlify redeplegará la web desde GitHub.

## Seguridad

En local el admin acepta escrituras sin token si se accede desde `localhost`.
En producción, las escrituras y la bandeja privada exigen `ADMIN_TOKEN`.

## Netlify Forms

El admin todavía no lee Netlify Forms directamente. La pestaña “Solicitudes” está preparada para ese flujo, usando ahora `admin/solicitudes-herois.json` como mock local. El siguiente paso sería que una función `formSubmitted` o un importador desde la API de Netlify Forms escriba solicitudes pendientes en Netlify Blobs o en ese JSON privado.

## Cambios de esta revisión

- La home se ha simplificado: se añade una sección rápida de tres caminos principales y se ocultan en portada los bloques largos de “El repte” y “La causa”, que quedan accesibles desde `el-repte.html`.
- El campo `idioma` de los formularios ahora es visible y editable como selector `CA / ES / EN`; se rellena por defecto según el idioma activo.
- La newsletter adapta el campo de idioma para que sea legible sobre fondo azul y en móvil aparezca arriba del email.
- El título y las referencias inglesas principales usan “Llobregat for Diabetes”.
- La mejora SEO/idiomas es interna: `html[lang]`, títulos, meta description y accesibilidad se sincronizan por idioma activo. Visualmente la web debe verse igual salvo el texto activo.

## Formulario universal · fase 1

Se ha añadido un formulario universal `solicitud-universal` que se abre desde los CTA existentes de la web.

Tipos activos en esta fase:

- Newsletter / novedades.
- Heroi o Heroïna.
- Poble / municipio.
- Patrocini.
- Colaborador.
- Voluntario.
- Contacto / otras consultas.

La opción `participant` existe en el desplegable, pero queda bloqueada: no permite enviar el formulario hasta que se active el flujo de inscripción con camiseta y pago seguro vía Stripe/AREDI.

Los botones antiguos siguen existiendo en el HTML, pero `assets/lxd-universal-form.js` los redirige al formulario universal y preselecciona el tipo correspondiente. Por ejemplo:

```html
<a href="#" data-open-drawer="heroi">...</a>
```

abre ahora el formulario universal con `tipus_solicitud = heroi`.

Para forzar un tipo concreto desde un botón, se puede usar:

```html
<a href="#" data-open-drawer="universal" data-universal-type="voluntari">...</a>
```

En patrocini se conserva `data-nivell`, por ejemplo:

```html
<a href="#" data-open-drawer="patrocini" data-nivell="general">...</a>
```

Eso abre el formulario universal, selecciona `patrocini` y preselecciona el nivel `general`.
