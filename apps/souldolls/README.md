# Souldolls — prototipo jugable

MVP de exploración, combate y colección en 3D creado con Three.js dentro del
monorepo de GGEZ. El mundo se renderiza en 3D; la protagonista, Mara y las
almas son sprites 2D tipo billboard que siempre miran a cámara. Los retratos se
dibujan en Canvas, así que el prototipo no depende de arte externo.

El juego se apoya en el stack de la plataforma: la escena se describe como
`RuntimeScene` (`@ggez/runtime-format`), se carga con `@ggez/three-runtime` y
la lógica de juego corre sobre `@ggez/gameplay-runtime`.

## Ejecutar

Desde la raíz del repositorio:

```bash
bun run dev:souldolls
```

Abre la URL local que muestra Vite.

```bash
bun run --cwd apps/souldolls test      # tests del motor y de la integración
bun run --cwd apps/souldolls typecheck
```

## Controles

- `WASD` o flechas: explorar.
- `E` o `Enter`: hablar, desafiar o vincularte con el alma que tengas cerca.
- `P` o `Tab`: abrir/cerrar la colección.
- En móvil: cruceta táctil y botón de acción.

El progreso (colección, vínculos y posición) se guarda en `localStorage`.

## Sistemas de juego

Están modelados como los de un RPG de colección por turnos:

- **Tipos y efectividad** — `src/pokemon/types.ts`: Brote, Bruma, Agua, Roca,
  Sombra y Luz, con tabla de efectividad y multiplicador de tipo propio (STAB).
- **Especies y evoluciones** — `src/pokemon/species.ts`: estadísticas base,
  tipos, lista de movimientos aprendidos, curva de captura y evolución por nivel.
- **Movimientos** — `src/pokemon/moves.ts`: físico, especial y de estado
  (veneno, dormido, paralizado).
- **Progresión** — `src/pokemon/creature.ts`: experiencia, subida de nivel,
  aprendizaje de movimientos y evolución.
- **Batalla por turnos** — `src/pokemon/battle.ts`: orden por velocidad, daño
  con críticos, estados, cambio de criatura, captura y huida.
- **Vínculos y colección** — `src/pokemon/roster.ts`: máximo de seis almas,
  vínculos consumibles y recompensas.

## Integración con GGEZ

- `src/scene/souldolls-scene.ts` describe el claro como `RuntimeScene`
  (geometría, materiales, luces, entidades y hooks).
- Los hooks de `interactable` y `trigger_volume` alimentan los sistemas
  `InteractionSystem` y `TriggerSystem` de `@ggez/gameplay-runtime`.
- Un `sequence` en Mara entrega el primer vínculo mediante el evento
  `mara.entrega`.
- `src/gameplay/systems.ts` registra los sistemas usados por la partida.

## Estructura

- `src/game.ts`: ciclo de juego, movimiento, encuentros y flujo de batalla.
- `src/scene/`: descripción de la escena del claro en formato runtime.
- `src/pokemon/`: tipos, especies, movimientos, batalla, progresión y colección.
- `src/sprites.ts`: sprites billboard 2D generados desde Canvas.
- `src/input.ts`: teclado y entrada táctil.
- `src/ui.ts` / `src/styles.css`: HUD, diálogo, colección, batalla y presentación responsive.
- `src/save.ts`: persistencia local versionada.
