# Spanish (es) strings for native-speaker review — 2026-10-30

**Spanish not native-reviewed.** No native-speaker review of the Spanish table has ever been recorded (HANDOFF.md, AUDIT.md
FR-14 "partial (manual)"). Every Spanish string below is a draft by contributors and AI assistants. Until a reviewer signs
off, treat the whole Spanish UI as unreviewed.

Source: `src/ui/strings.ts` on main `595fd0689134` (162 keys; a unit test enforces identical keys in `en` and `es`).
Baseline for "changed": `4c5dcc4` (v0.3.0, 2026-10-21), the last release-version change to the strings. `{name}` placeholders
are filled at run time and must stay as they are.

## What the reviewer is asked

1. Is each Spanish string correct, natural and plain (no technical jargon; "huella digital" = fingerprint, "recibo" = receipt)?
2. Does it keep the meaning of the English, especially limits: a receipt proves a file existed unchanged by a time; it does
   **not** prove authorship, exact creation time or truth; metadata cleaning is **not** full sanitization; pending is not proof.
3. Are the five mandatory copy blocks (SPEC section 11) faithful? Keys: `copy.stays`, `copy.notTrue`, `copy.keep`, `copy.pendingNotProof`, `copy.visibleToServers`.
4. Is the register consistent (the app uses informal "tú")?

Return: per key, OK or a corrected string, plus a note. Corrections go into `src/ui/strings.ts` in a later change.

## Priority 1 — changed or new since v0.3.0 (on main)

| Key | English | Spanish (draft) | Change |
|---|---|---|---|
| `stamp.rejected` | This file looks damaged or unsafe, so it was not processed: {reason} | Este archivo parece dañado o inseguro, por lo que no se procesó: {reason} | changed |
| `stamp.cancelled` | Cancelled. Remove this file, or add it again to start over. | Cancelado. Quita este archivo o vuelve a añadirlo para empezar de nuevo. | new |
| `verify.state.link.NO_MATCH_FILE` | No match: different fingerprint | No coincide: huella digital distinta | new |
| `verify.link.VERIFIED` | The fingerprint from the link existed no later than the time below. No file was checked: choose the file to confirm it has this fingerprint. | La huella digital del enlace existía a más tardar en la hora indicada. No se comprobó ningún archivo: elige el archivo para confirmar que tiene esta huella digital. | new |
| `verify.link.PENDING` | The fingerprint from the link matches the receipt, but the receipt is not anchored in Bitcoin yet. No file was checked. Use Upgrade later. | La huella digital del enlace coincide con el recibo, pero el recibo aún no está anclado en Bitcoin. No se comprobó ningún archivo. Usa Actualizar más tarde. | new |
| `verify.link.NO_MATCH_FILE` | The receipt is fine, but it was made for a different fingerprint than the one in the link. No file was checked. | El recibo está bien, pero se hizo para una huella digital distinta de la del enlace. No se comprobó ningún archivo. | new |
| `upgrade.confirmed` | Bitcoin timestamp data was added. Download the upgraded receipt, then use Verify with the original file to check it. | Se añadieron datos de una marca de tiempo de Bitcoin. Descarga el recibo actualizado y usa Verificar con el archivo original para comprobarlos. | changed |
| `upgrade.alreadyConfirmed` | This receipt contains Bitcoin timestamp data. Use Verify with the original file to check it. | Este recibo contiene datos de una marca de tiempo de Bitcoin. Usa Verificar con el archivo original para comprobarlos. | changed |
## Priority 1b — proposed in open PR30 (not on main; review only if PR30 merges)

| Key | English | Spanish (draft) |
|---|---|---|
| `upgrade.unreadable` | This browser could not read the answer from one or more calendar servers. While a receipt is still pending, calendar servers usually answer in a way browsers are not allowed to read, so this is expected. Your receipt is unchanged and still pending. Check again later. | Este navegador no pudo leer la respuesta de uno o más servidores de calendario. Mientras un recibo está pendiente, los servidores suelen responder de una forma que los navegadores no pueden leer, así que es lo esperado. Tu recibo no cambió y sigue pendiente. Vuelve a comprobarlo más tarde. |
## Priority 2 — unchanged since v0.3.0, never native-reviewed

| Key | English | Spanish (draft) |
|---|---|---|
| `lang.code` | en | es |
| `common.copy` | Copy | Copiar |
| `common.copied` | Copied | Copiado |
| `common.copyFailed` | Copy failed | No se pudo copiar |
| `common.remove` | Remove | Quitar |
| `common.cancel` | Cancel | Cancelar |
| `nav.stamp` | Stamp | Sellar |
| `nav.verify` | Verify | Verificar |
| `nav.about` | About | Acerca de |
| `nav.settings` | Settings | Ajustes |
| `nav.skip` | Skip to content | Saltar al contenido |
| `footer.version` | Version | Versión |
| `footer.build` | build | compilación |
| `footer.note` | Compare the build code with the published checksums. Beware of copies of this page on other sites. | Compara el código de compilación con las sumas de verificación publicadas. Cuidado con copias de esta página en otros sitios. |
| `copy.stays` | Your file stays on your device. Only its fingerprint is used. | Tu archivo se queda en tu dispositivo. Solo se usa su huella digital. |
| `copy.notTrue` | A receipt proves a file existed unchanged. It does not prove the file is true. | Un recibo demuestra que un archivo existía sin cambios. No demuestra que el archivo sea verdadero. |
| `copy.keep` | Keep your receipt. We don't store it. | Guarda tu recibo. Nosotros no lo almacenamos. |
| `copy.pendingNotProof` | Pending is not proof yet. | Pendiente todavía no es una prueba. |
| `copy.visibleToServers` | Stamping is visible to the servers you contact. For sensitive use, use Tor Browser. | El sellado es visible para los servidores con los que te conectas. Para un uso delicado, usa el Navegador Tor. |
| `stamp.title` | Prove this file existed, unchanged. | Demuestra que este archivo existía, sin cambios. |
| `stamp.drop` | Choose files to stamp, or drop them here | Elige los archivos a sellar o suéltalos aquí |
| `stamp.dropHint` | You can choose several files at once. Nothing is uploaded. | Puedes elegir varios a la vez. No se sube nada. |
| `stamp.working` | Working on your file… | Procesando tu archivo… |
| `stamp.stripLabel` | Remove hidden data (location, camera, song tags, etc.) before stamping | Quitar datos ocultos (ubicación, cámara, etiquetas de canciones, etc.) antes de sellar |
| `stamp.cleanedNotice` | The receipt applies only to the cleaned copy. Download it and keep it together with the receipt. | El recibo se aplica solo a la copia limpia. Descárgala y guárdala junto con el recibo. |
| `stamp.removed` | Removed: | Eliminado: |
| `stamp.nothingRemoved` | No hidden data was found in this file. | No se encontraron datos ocultos en este archivo. |
| `stamp.limits` | This removes hidden data, not what the picture shows: faces, places, shadows, text and camera sensor patterns remain. | Esto elimina datos ocultos, no lo que muestra la imagen: rostros, lugares, sombras, texto y patrones del sensor de la cámara permanecen. |
| `stamp.limitsAudio` | This removes tags and embedded metadata, not the recording itself: the sound, any watermark in the audio, and encoder details inside the audio data remain. | Esto elimina etiquetas y metadatos incrustados, no la grabación: el sonido, cualquier marca de agua en el audio y detalles del codificador dentro de los datos de audio permanecen. |
| `stamp.downloadCleaned` | Download cleaned copy ({name}) | Descargar copia limpia ({name}) |
| `stamp.cleanedDownloaded` | Cleaned copy downloaded. | Copia limpia descargada. |
| `stamp.mustDownload` | Download the cleaned copy to continue. | Descarga la copia limpia para continuar. |
| `stamp.fileNameWarning` | File names can identify you. The cleaned copy is named after the original; rename it before sharing if needed. | Los nombres de archivo pueden identificarte. La copia limpia lleva el nombre del original; cámbialo antes de compartir si hace falta. |
| `stamp.orientationWarn` | This photo is stored rotated. Removing hidden data may change how it is displayed. I understand and want to continue. | Esta foto está guardada girada. Quitar los datos ocultos puede cambiar cómo se muestra. Lo entiendo y quiero continuar. |
| `stamp.pdfWarn` | PDF files often contain author names, software and edit history. We cannot remove them. This file type may contain hidden data we cannot remove. | Los PDF suelen contener nombres de autor, software e historial de ediciones. No podemos quitarlos. Este tipo de archivo puede contener datos ocultos que no podemos eliminar. |
| `stamp.stripOffWarn` | You turned off cleaning. This file may contain hidden data such as location or camera details. | Desactivaste la limpieza. Este archivo puede contener datos ocultos como ubicación o detalles de la cámara. |
| `stamp.unsupportedWarn` | This file type may contain hidden data we cannot remove. | Este tipo de archivo puede contener datos ocultos que no podemos eliminar. |
| `stamp.ack` | I understand and want to continue with this file as it is. | Lo entiendo y quiero continuar con este archivo tal como está. |
| `stamp.fingerprint` | Fingerprint | Huella digital |
| `stamp.fingerprintAria` | Fingerprint of the file in groups of eight characters | Huella digital del archivo en grupos de ocho caracteres |
| `stamp.create` | Create receipt | Crear recibo |
| `stamp.createMany` | Create {n} receipts | Crear {n} recibos |
| `stamp.creating` | Creating receipt… | Creando recibo… |
| `stamp.completeSteps` | Finish the steps above for every file to continue. | Completa los pasos anteriores en cada archivo para continuar. |
| `stamp.fixErrors` | Remove files marked with a problem to continue. | Quita los archivos marcados con un problema para continuar. |
| `stamp.done` | Receipt created. It is pending. | Recibo creado. Está pendiente. |
| `stamp.pendingTitle` | Pending: not yet proof. | Pendiente: todavía no es una prueba. |
| `stamp.pendingBody` | Come back in a few hours and press Upgrade (on the Verify page). | Vuelve en unas horas y pulsa Actualizar (en la página Verificar). |
| `stamp.keepTitle` | Keep this receipt. | Guarda este recibo. |
| `stamp.keepBody` | We do not store it. If you lose it, it cannot be recovered. | No lo almacenamos. Si lo pierdes, no se puede recuperar. |
| `stamp.downloadReceipt` | Download receipt ({name}) | Descargar recibo ({name}) |
| `stamp.receiptName` | The receipt is a standard OpenTimestamps file. Keep it next to the file it belongs to. | El recibo es un archivo estándar de OpenTimestamps. Guárdalo junto al archivo al que pertenece. |
| `stamp.copyLink` | Copy share link | Copiar enlace para compartir |
| `stamp.linkNote` | Contains only the fingerprint, no file name. | Solo contiene la huella digital, sin nombre de archivo. |
| `stamp.labelField` | Label (optional) | Etiqueta (opcional) |
| `stamp.saveToList` | Save to list on this device | Guardar en la lista de este dispositivo |
| `stamp.savedToList` | Saved. | Guardado. |
| `stamp.saveFailed` | Could not save on this device. | No se pudo guardar en este dispositivo. |
| `verify.title` | Check a file against a receipt. | Comprueba un archivo con un recibo. |
| `verify.step1` | 1. The file | 1. El archivo |
| `verify.step2` | 2. The receipt | 2. El recibo |
| `verify.prefilled` | Fingerprint from a link. You can check a receipt without the file, or choose the file below. | Huella digital de un enlace. Puedes comprobar un recibo sin el archivo, o elegir el archivo abajo. |
| `verify.dropFile` | Choose the original file, or drop it here | Elige el archivo original o suéltalo aquí |
| `verify.dropFileHint` | If you stamped a cleaned copy, choose the cleaned copy. | Si sellaste una copia limpia, elige la copia limpia. |
| `verify.dropReceipt` | Choose the receipt (.ots), or drop it here | Elige el recibo (.ots) o suéltalo aquí |
| `verify.dropReceiptHint` | The receipt file ends in .ots. | El archivo del recibo termina en .ots. |
| `verify.check` | Check | Comprobar |
| `verify.checking` | Checking… | Comprobando… |
| `verify.working` | Working… | Procesando… |
| `verify.state.VERIFIED` | Verified | Verificado |
| `verify.state.PENDING` | Not yet confirmed | Aún sin confirmar |
| `verify.state.NO_MATCH_FILE` | No match: this file is different | No coincide: este archivo es distinto |
| `verify.state.INVALID_PROOF` | The receipt is not valid | El recibo no es válido |
| `verify.state.SOURCES_DISAGREE` | Do not trust: sources disagree | No confíes: las fuentes discrepan |
| `verify.state.UNREACHABLE` | Could not check | No se pudo comprobar |
| `verify.body.VERIFIED` | This exact file existed no later than the time below, and has not changed since. | Este archivo exacto existía a más tardar en la hora indicada y no ha cambiado desde entonces. |
| `verify.body.PENDING` | The file matches the receipt, but the receipt is not anchored in Bitcoin yet. Use Upgrade later. | El archivo coincide con el recibo, pero el recibo aún no está anclado en Bitcoin. Usa Actualizar más tarde. |
| `verify.body.NO_MATCH_FILE` | The receipt is fine, but it was made for a different file. This file is not the one that was stamped. | El recibo está bien, pero se hizo para otro archivo. Este archivo no es el que se selló. |
| `verify.body.INVALID_PROOF` | The receipt is damaged, incomplete or not what it claims to be. Do not rely on it. | El recibo está dañado, incompleto o no es lo que dice ser. No confíes en él. |
| `verify.body.SOURCES_DISAGREE` | The block explorers gave different answers. This result cannot be trusted. Verify with your own Bitcoin node. | Los exploradores de bloques dieron respuestas distintas. No se puede confiar en este resultado. Verifica con tu propio nodo de Bitcoin. |
| `verify.body.UNREACHABLE` | We could not reach enough independent block explorers. Try again, or verify with your own Bitcoin node. | No pudimos contactar con suficientes exploradores de bloques independientes. Inténtalo de nuevo o verifica con tu propio nodo de Bitcoin. |
| `verify.d.fingerprint` | Fingerprint | Huella digital |
| `verify.d.fromLink` | (from link) | (del enlace) |
| `verify.d.block` | Bitcoin block | Bloque de Bitcoin |
| `verify.d.time` | Block time | Hora del bloque |
| `verify.d.noLater` | This file existed no later than about {time} (UTC) | Este archivo existía a más tardar hacia {time} (UTC) |
| `verify.d.sources` | Confirmed by | Confirmado por |
| `verify.d.calendars` | Waiting on | Esperando a |
| `verify.trust.title` | Trust level L1: explorer check. | Nivel de confianza L1: comprobación con exploradores. |
| `verify.trust.l1` | This relies on at least two independent block explorers not working together or both being compromised. | Esto depende de que al menos dos exploradores de bloques independientes no estén coludidos ni comprometidos a la vez. |
| `verify.trust.l2` | For important cases, verify with the reference tool and your own Bitcoin node (level L2). See the instructions below. | Para casos importantes, verifica con la herramienta de referencia y tu propio nodo de Bitcoin (nivel L2). Mira las instrucciones abajo. |
| `verify.trust.timeCaveat` | Block times are set by miners and are only accurate to roughly a couple of hours. | Las horas de los bloques las fijan los mineros y solo son exactas con un margen de un par de horas. |
| `upgrade.title` | Upgrade a pending receipt | Actualizar un recibo pendiente |
| `upgrade.intro` | A few hours after stamping, ask the calendar servers for the Bitcoin confirmation and get an upgraded receipt. | Unas horas después de sellar, pide a los servidores de calendario la confirmación de Bitcoin y obtén un recibo actualizado. |
| `upgrade.drop` | Choose a pending receipt (.ots), or drop it here | Elige un recibo pendiente (.ots) o suéltalo aquí |
| `upgrade.run` | Check for confirmation | Buscar confirmación |
| `upgrade.stillPending` | Not confirmed yet. Try again in a few hours. | Aún no está confirmado. Inténtalo de nuevo en unas horas. |
| `upgrade.download` | Download upgraded receipt ({name}) | Descargar recibo actualizado ({name}) |
| `upgrade.newFile` | This is a new file. Your original receipt was not changed. Keep both. | Es un archivo nuevo. Tu recibo original no se modificó. Guarda ambos. |
| `upgrade.unknownCalendar` | This receipt names calendar servers that this app does not contact: {hosts}. They were skipped. | Este recibo nombra servidores de calendario con los que esta aplicación no se conecta: {hosts}. Se omitieron. |
| `about.title` | What this proves, and what it does not. | Qué demuestra esto y qué no. |
| `about.table.caption` | What a receipt proves and what it does not | Qué demuestra un recibo y qué no |
| `about.proves` | Proves | Demuestra |
| `about.doesNot` | Does not prove | No demuestra |
| `about.p1` | This exact file (to the byte) existed before the time of the Bitcoin block that anchors it. | Que este archivo exacto (byte a byte) existía antes de la hora del bloque de Bitcoin que lo ancla. |
| `about.p2` | The file has not been changed since it was stamped. | Que el archivo no ha cambiado desde que se selló. |
| `about.n1` | That the contents of the file are true or authentic. | Que el contenido del archivo sea verdadero o auténtico. |
| `about.n2` | Who created the file. | Quién creó el archivo. |
| `about.n3` | The exact time. Block times are only accurate to roughly a couple of hours. | La hora exacta. Las horas de los bloques solo son exactas con un margen de un par de horas. |
| `about.n4` | That you are anonymous when you stamp. The servers you contact can see your internet address. | Que seas anónimo al sellar. Los servidores con los que te conectas pueden ver tu dirección de internet. |
| `about.how.title` | How it works | Cómo funciona |
| `about.how.1` | Your browser computes a fingerprint (SHA-256) of the file. The file never leaves your device. | Tu navegador calcula una huella digital (SHA-256) del archivo. El archivo nunca sale de tu dispositivo. |
| `about.how.2` | Only the fingerprint, mixed with a random number, is sent to public OpenTimestamps calendar servers. | Solo la huella digital, mezclada con un número aleatorio, se envía a servidores de calendario públicos de OpenTimestamps. |
| `about.how.3` | The calendars anchor it in the Bitcoin blockchain within hours. You download the receipt (.ots). | Los calendarios la anclan en la cadena de bloques de Bitcoin en unas horas. Tú descargas el recibo (.ots). |
| `about.how.4` | Anyone with the file and the receipt can check them, with this app or independent tools. | Cualquiera que tenga el archivo y el recibo puede comprobarlos, con esta aplicación o con herramientas independientes. |
| `about.time.title` | About time | Sobre la hora |
| `about.time.body` | Bitcoin block times are set by miners and are only loosely constrained: later than the median of recent blocks and not more than about two hours ahead of network time. So we say this file existed no later than about this time. We never claim when it was made. | Las horas de los bloques de Bitcoin las fijan los mineros y solo están limitadas de forma laxa: posteriores a la mediana de los bloques recientes y no más de unas dos horas por delante de la hora de la red. Por eso decimos que este archivo existía a más tardar hacia esta hora. Nunca afirmamos cuándo se hizo. |
| `about.privacy.title` | Privacy | Privacidad |
| `about.privacy.body` | We run no servers, keep no accounts and use no analytics. This app does not hide your internet address from the calendar and explorer servers it contacts. Use Tor Browser or a trusted VPN when that matters. Do not claim anonymity. | No usamos servidores propios, cuentas ni analítica. Esta aplicación no oculta tu dirección de internet a los servidores de calendario y de exploración con los que se conecta. Usa el Navegador Tor o una VPN de confianza cuando importe. No presumas de anonimato. |
| `about.strip.title` | Removing hidden data from pictures | Quitar datos ocultos de las imágenes |
| `about.strip.body` | For JPEG and PNG pictures we keep only the parts needed to show the picture and drop everything else, then fingerprint the cleaned copy. | En imágenes JPEG y PNG conservamos solo lo necesario para mostrar la imagen y descartamos el resto; luego calculamos la huella digital de la copia limpia. |
| `about.strip.1` | It removes metadata, not content: faces, landmarks, shadows, visible text and sensor-noise patterns remain. | Elimina metadatos, no contenido: rostros, lugares, sombras, texto visible y patrones de ruido del sensor permanecen. |
| `about.strip.2` | Copies uploaded elsewhere may keep their own hidden data. | Las copias subidas a otros sitios pueden conservar sus propios datos ocultos. |
| `about.strip.3` | File names and file dates are outside the file. Names can identify you. | El nombre y las fechas del archivo están fuera del archivo. Los nombres pueden identificarte. |
| `about.strip.4` | For high-stakes cases, a screenshot of the picture can be safer than any tool. | En casos de alto riesgo, una captura de pantalla de la imagen puede ser más segura que cualquier herramienta. |
| `about.indep.title` | Check independently | Comprueba por tu cuenta |
| `about.indep.body` | Never rely on this app alone. A receipt is a standard OpenTimestamps file that other tools can verify, so you can always check it without us. | Nunca dependas solo de esta aplicación. Un recibo es un archivo estándar de OpenTimestamps que otras herramientas pueden verificar, así que siempre puedes comprobarlo sin nosotros. |
| `about.l2.summary` | How to verify with your own Bitcoin node (level L2) | Cómo verificar con tu propio nodo de Bitcoin (nivel L2) |
| `about.l2.intro` | Install the reference tool and run: | Instala la herramienta de referencia y ejecuta: |
| `about.l2.cmdAria` | Commands to verify with the reference tool | Comandos para verificar con la herramienta de referencia |
| `about.l2.step1` | Run a fully synced Bitcoin Core node on a machine you control. | Ejecuta un nodo Bitcoin Core totalmente sincronizado en una máquina que controles. |
| `about.l2.step2` | Put the file and its .ots receipt in the same folder (replace YOUR_FILE with the real name). | Pon el archivo y su recibo .ots en la misma carpeta (cambia YOUR_FILE por el nombre real). |
| `about.l2.step3` | The tool reads your node settings and checks the block itself, with no explorers involved. | La herramienta lee la configuración de tu nodo y comprueba el bloque por sí misma, sin exploradores. |
| `about.l2.note` | If you stamped a cleaned copy, verify the cleaned copy, not the original. | Si sellaste una copia limpia, verifica la copia limpia, no el original. |
| `about.keep.title` | Keep your receipt | Guarda tu recibo |
| `about.phish.title` | Beware of copies | Cuidado con las copias |
| `about.phish.body` | The footer shows this version and a build code. Compare it with the published checksums. For the strongest protection save the single-file offline version and check its checksum before use. | El pie de página muestra esta versión y un código de compilación. Compáralo con las sumas de verificación publicadas. Para mayor protección guarda la versión sin conexión de un solo archivo y comprueba su suma de verificación antes de usarla. |
| `settings.title` | Settings | Ajustes |
| `settings.language` | Language | Idioma |
| `settings.receipts` | Receipt list on this device | Lista de recibos en este dispositivo |
| `settings.receiptsBody` | Off by default. When on, the app remembers the fingerprint, time and an optional label of each receipt you create, in this browser only. Receipt files are never stored. | Desactivada por defecto. Si la activas, la aplicación recuerda la huella digital, la hora y una etiqueta opcional de cada recibo que creas, solo en este navegador. Los archivos de recibo nunca se guardan. |
| `settings.receiptsToggle` | Remember my receipts on this device | Recordar mis recibos en este dispositivo |
| `settings.receiptsEmpty` | No receipts saved yet. | Aún no hay recibos guardados. |
| `settings.receiptsNote` | Turning this off deletes the list. Anyone using this browser profile can see it. | Al desactivarlo se borra la lista. Cualquiera que use este perfil del navegador puede verla. |
| `settings.noStorage` | Saving on this device is not available in this browser. | Guardar en este dispositivo no está disponible en este navegador. |
| `settings.advanced` | Advanced | Avanzado |
| `settings.banner` | Custom endpoints change who sees your activity. | Los puntos de conexión personalizados cambian quién ve tu actividad. |
| `settings.calendars` | Calendar servers | Servidores de calendario |
| `settings.minCalendars` | Calendars that must accept (minimum 1) | Calendarios que deben aceptar (mínimo 1) |
| `settings.explorers` | Block explorers for verification | Exploradores de bloques para verificar |
| `settings.explorerNote` | At least two independent explorers are needed to verify. Only servers built into this version can be chosen. | Se necesitan al menos dos exploradores independientes para verificar. Solo se pueden elegir servidores incluidos en esta versión. |
| `settings.errNoCalendars` | Select at least one calendar server or stamping will fail. | Selecciona al menos un servidor de calendario o el sellado fallará. |
| `settings.errExplorers` | Select at least two explorers or verification will report that it could not check. | Selecciona al menos dos exploradores o la verificación indicará que no pudo comprobar. |
| `settings.restore` | Restore defaults | Restaurar valores por defecto |
