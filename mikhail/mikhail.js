const MIKHAIL_DATA = [
    {
        id: "dark_mikhail",
        name: "미하일",
        element: "dark",
        title: "황혼의 추적자",
        image: "mikhail/dark_mikhail.png",
        voices: [
            {
                id: "v_auto_1771231051",
                label: "자기소개",
                transcript: "명령하시면, 수행합니다. 그것으로 충분합니다.",
                audio: "mikhail/mikail.mp3"
            },
            {
                id: "v_auto_1771231109",
                label: "영웅 영입 1",
                transcript: "미하일 블레이크, 로드의, 눈과 발이 되겠습니다.",
                audio: "mikhail/mikail (1).mp3"
            },
            {
                id: "v_auto_1771231159",
                label: "영웅 영입 2",
                transcript: "제 충성의 대상은, 언제까지나 로드 뿐입니다.",
                audio: "mikhail/mikail (3).mp3"
            },
            {
                id: "v_auto_1771233142",
                label: "영웅 초월 1",
                transcript: "새로운 가능성을, 얻었습니다.",
                audio: "mikhail/mikail (5).mp3"
            },
            {
                id: "v_auto_1771233186",
                label: "영웅 초월 2",
                transcript: "잠재력이…. 늘어났을까요?",
                audio: "mikhail/mikail (6).mp3"
            },
            {
                id: "v_auto_1771233288",
                label: "영웅 초월 3",
                transcript: "신선한 감각입니다.",
                audio: "mikhail/mikail (7).mp3"
            },
            {
                id: "v_auto_1771233380",
                label: "영웅 초월 4",
                transcript: "기량을 다시 쌓을 수 있겠군요.",
                audio: "mikhail/mikail (8).mp3"
            },
            {
                id: "v_auto_1771233423",
                label: "영웅 각성 1",
                transcript: "보다, 먼 곳을 볼 수 있게 된 것 같습니다.",
                audio: "mikhail/mikail (9).mp3"
            },
            {
                id: "v_auto_1771233541",
                label: "영웅 각성 2",
                transcript: "로드의 기대에, 반드시 부응하겠습니다.",
                audio: "mikhail/mikail (10).mp3"
            },
            {
                id: "v_auto_1771233589",
                label: "영웅 각성 3",
                transcript: "활력이 솟아 오릅니다. 감사합니다.",
                audio: "mikhail/mikail (11).mp3"
            },
            {
                id: "v_auto_1771233950",
                label: "타이틀 콜",
                transcript: "Lord Of Heroes.",
                audio: "mikhail/mikail (12).mp3"
            }
        ]
    }
];

if (typeof window !== "undefined") {
    if (!Array.isArray(window.HERO_DATA)) {
        window.HERO_DATA = [];
    }
    window.HERO_DATA.push(...MIKHAIL_DATA);
}

