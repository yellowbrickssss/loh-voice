const RALIGON_DATA =[
        {
        id: "earth_raligon",
        name: "라르곤",
        element: "earth",
        title: "어둠을 비추는 서광",
        image: "raligon/earth_raligon.png",
        voices: [
        ]
    }
]

if (typeof window !== "undefined") {
    if (!Array.isArray(window.HERO_DATA)) {
        window.HERO_DATA = [];
    }
    window.HERO_DATA.push(...RALIGON_DATA);
}
