# 3D Brand Sites for Indian D2C

Scroll-driven 3D product websites for two fictional Indian beverage brands. Built with Three.js; every 3D model is generated in code, so there are no model files and no build step.

| Demo | Concept |
|---|---|
| [**KADAK**](kadak/) · *Chai, reimagined.* | A clay kulhad cracks into shards as you scroll and a can of cold-brew masala chai rises out of it, surrounded by flying spices. Includes a 5-flavour switcher that re-paints the can and the page. |
| [**HAPUS**](hapus/) · *The King, bottled.* | An Alphonso mango slices in half and a bottle of aamras rises between the halves. Includes drag-to-spin with orbiting nutrition badges, a 3-product switcher and a live 2027 harvest countdown. |

Both are mobile-first and include ₹ pricing and WhatsApp ordering.

## Run locally

ES modules need a server, so opening the HTML file directly won't work:

```bash
npx serve -l 3000
```

Then open http://localhost:3000.

## Stack

- [Three.js](https://threejs.org/) r160 via CDN import map
- Plain HTML, CSS and JavaScript

---

*Concept projects. KADAK and HAPUS are fictional brands.*
