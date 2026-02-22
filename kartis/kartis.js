const KARTIS_DATA =[
        {
        id: "light_kartis",
        name: "카르티스",
        element: "light",
        title: "재앙의 대적자",
        image: "kartis/kartis.png",
        voices: [
                        {
                id: "v_auto_1771672712",
                label: "자기소개",
                transcript: "이름은 카르티스, 신분은 3왕자. 대외적 이미지는? …망나니!",
                audio: "kartis/[빛] 왕자 카르티스 자기소개.mp3"
            },
            {
                id: "v_auto_1771672765",
                label: "영웅 영입 1",
                transcript: "우리, 구면이던가?",
                audio: "kartis/[빛] 왕자 카르티스 영웅 영입 1.mp3"
            },
            {
                id: "v_auto_1771672802",
                label: "영웅 영입 2",
                transcript: "몸은 가볍지만 마음은 그렇지도 않을걸?",
                audio: "kartis/[빛] 왕자 카르티스 영웅 영입 2.mp3"
            },
            {
                id: "v_auto_1771672843",
                label: "영웅 영입 3",
                transcript: "얼마나 있다 갈진 모르겠지만, 잘 부탁해.",
                audio: "kartis/[빛] 왕자 카르티스 영웅 영입 3.mp3"
            },
            {
                id: "v_auto_1771672873",
                label: "영웅 영입 4",
                transcript: "내 충성 같은 걸 얻어서 어디다 쓰려고?",
                audio: "kartis/[빛] 왕자 카르티스 영웅 영입 4.mp3"
            },
            {
                id: "v_auto_1771672966",
                label: "영웅 초월 1",
                transcript: "이거, 더 할 수 있나?",
                audio: "kartis/[빛] 왕자 카르티스 영웅 초월 1.mp3"
            },
            {
                id: "v_auto_1771673011",
                label: "영웅 초월 2",
                transcript: "성벽 타고 딱! 착지할 때 이런 기분인데.",
                audio: "kartis/[빛] 왕자 카르티스 영웅 초월 2.mp3"
            },
            {
                id: "v_auto_1771673035",
                label: "영웅 초월 3",
                transcript: "어디서 바람이 부나?",
                audio: "kartis/[빛] 왕자 카르티스 영웅 초월 3.mp3"
            },
            {
                id: "v_auto_1771673058",
                label: "영웅 각성 1",
                transcript: "당신에게 뭘 해 주면 될까?",
                audio: "kartis/[빛] 왕자 카르티스 영웅 각성 1.mp3"
            },
            {
                id: "v_auto_1771673103",
                label: "영웅 각성 2",
                transcript: "흠, 대가를 바라고 한 건, 아닐 거라 믿어.",
                audio: "kartis/[빛] 왕자 카르티스 영웅 각성 2.mp3"
            },
            {
                id: "v_auto_1771673121",
                label: "영웅 각성 3",
                transcript: "맨입으로 받아먹긴 좀 미안한데.",
                audio: "kartis/[빛] 왕자 카르티스 영웅 각성 3.mp3"
            },
            {
                id: "v_auto_1771673153",
                label: "타이틀 콜",
                transcript: "Lord Of Heroes.",
                audio: "kartis/[빛] 왕자 카르티스 타이틀 콜.mp3"
            }
        ]
    }
]

if (typeof window !== "undefined") {
    if (!Array.isArray(window.HERO_DATA)) {
        window.HERO_DATA = [];
    }
    window.HERO_DATA.push(...KARTIS_DATA);
}