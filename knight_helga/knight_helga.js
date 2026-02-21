const KNIGHT_HELGA_DATA =[
        {
        id: "knight_helga",
        name: "용기사 헬가",
        element: "water",
        title: "영혼에 각인된 긍지",
        image: "knight_helga/knight_helga.png",
        voices: [
        ]
    }
]

if (typeof window !== "undefined") {
    if (!Array.isArray(window.HERO_DATA)) {
        window.HERO_DATA = [];
    }
    window.HERO_DATA.push(...KNIGHT_HELGA_DATA);
}