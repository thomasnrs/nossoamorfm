# Nosso Amor FM ❤️

Um mini site de rádio para comemorar 1 mês de namoro, com tema colorido e romântico, tocando sua stream do Icecast local.

## Como usar

1. Inicie seu servidor Icecast e confirme o mountpoint público:
   - Exemplo (MP3): `http://localhost:8000/stream`
   - Exemplo (OGG): `http://localhost:8000/stream.ogg`
2. Edite a URL da stream (se precisar):
   - Abra `js/script.js` e ajuste `STREAM_URL`.
   - Ou, no console do navegador:
```js
localStorage.setItem('radio.stream', 'http://localhost:8000/stream');
```
3. Coloque suas imagens na pasta `assets/`:
   - `assets/banner.jpg` — banner do topo
   - `assets/avatar1.jpg` — avatar 1
   - `assets/avatar2.jpg` — avatar 2
   - Opcional: `assets/heart.png` — favicon
4. Abra `index.html` em um navegador moderno e clique em ▶.

## Controles
- ▶ tocar / ⏸ pausar
- Indicador de status (conectando/tocando/parado/erro)
- Volume com persistência (salvo no `localStorage`)
- Até 3 tentativas automáticas de reconexão

## Dicas
- Alguns navegadores exigem clique antes do áudio tocar.
- Acesso via arquivo (`file://`) pode limitar streams remotas; para localhost geralmente ok.
- Se mudar host/porta, ajuste a URL e libere no firewall.

Feito com 💖.
