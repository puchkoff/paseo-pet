<p align="center"><img src="assets/icon.png" width="112" alt="Pet logo"></p>

<h1 align="center">Pet</h1>

<p align="center">A pet (Rottweiler or cat) in the <a href="https://paseo.sh">Paseo</a> sidebar that mirrors your agents.</p>

![Pet in the Paseo sidebar with its agent list open (mockup with sample data)](docs/screenshot.png)

The pet sleeps when nothing runs, walks back and forth while agents work, and waves when one of them needs your permission. Its label counts the agents it is watching.

Click the pet to open the list of working agents. Each row shows the agent, its workspace and its host. Click a row to open that agent in its workspace, on any connected host. Pick Rottweiler or cat at the top of that list; the choice is saved.

The plugin runs in the app only. Every 3 seconds it reads the agent and workspace lists of each online host through the app's own connection and sends nothing anywhere else.

## Install

```bash
paseo plugin install github:puchkoff/paseo-pet
```

Requires Paseo 0.11.4 or later with plugins enabled (Settings → Plugins).

## License

MIT
