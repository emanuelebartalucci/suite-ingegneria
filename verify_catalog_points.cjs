const { LEGRAND_SUPPORT_CATALOG } = require('./src/data/supportCatalog.ts');

// SWL Table from Page 125 of Canali Legrand.pdf at L = 2000mm (N/m):
// H50: 50(137), 75(147), 100(167), 150(225), 200(296), 300(392), 400(429), 500(449)
// H75: 50(158), 75(164), 100(217), 150(286), 200(388), 300(593), 400(603), 500(613)

console.log("Checking supportCatalog.ts vs Page 125 SWL table numbers at 2000mm...");

LEGRAND_SUPPORT_CATALOG.forEach(entry => {
    const pt2000 = entry.curva_carico.find(p => p.distanza_mm === 2000);
    console.log(`${entry.serie} - ${entry.tipologia} - H${entry.altezza_mm}xW${entry.larghezza_mm}: 2000mm = ${pt2000 ? pt2000.carico_Nm : 'N/A'} N/m`);
});
