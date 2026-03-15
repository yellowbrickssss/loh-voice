const SCALENE_DATA =[
        {
        id: "dark_scalene",
        name: "스칼렌",
        element: "dark",
        title: "창명의 천체",
        image: "asset/scalene/dark_scalene.png",
        voices: [
        ]
    }
]

if (typeof window !== "undefined") {
    if (!Array.isArray(window.HERO_DATA)) {
        window.HERO_DATA = [];
    }
    window.HERO_DATA.push(...SCALENE_DATA);
}