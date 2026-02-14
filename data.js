/**
 * Hero Voice Data Repository
 * Structure: Hero -> Element -> Voices
 */

const HERO_DATA = [
          {
        id: "ondal_earth",
        name: "온달",
        element: "earth",
        title: "최후에 올라선 자",
        image: "ondal/earth_ondal.png",
        voices: [
                        {
                id: "v_auto_1771063676",
                label: "자기소개 1",
                transcript: "전우이자 동료로서, 너에게 의리를 다하겠다.",
                audio: "ondal/ondal.mp3"
            },
                        {
                id: "v_auto_1771063789",
                label: "영웅 영입 1",
                transcript: "오랜만에 보는 것 같군, 잘 지냈나?",
                audio: "ondal/ondal (1).mp3"
            },
                        {
                id: "v_auto_1771063957",
                label: "영웅 영입 2",
                transcript: "가우리의 온달이다. 약속한 날까지, 잘 부탁하지.",
                audio: "ondal/ondal (2).mp3"
            },
                        {
                id: "v_auto_1771065709",
                label: "영웅 초월 1",
                transcript: "이런 게 가능했군, 네 능력인가?",
                audio: "ondal/ondal (3).mp3"
            },
                        {
                id: "v_auto_1771066046",
                label: "영웅 초월 2",
                transcript: "도술이나 마법과는 다른 힘 같은데.",
                audio: "ondal/ondal (4).mp3"
            },
                        {
                id: "v_auto_1771066218",
                label: "영웅 초월 3",
                transcript: "그래, 네 덕분이다.",
                audio: "ondal/ondal (5).mp3"
            },
                        {
                id: "v_auto_1771066688",
                label: "영웅 각성 1",
                transcript: "힘이 넘쳐나는군.",
                audio: "ondal/ondal (6).mp3"
            },
                        {
                id: "v_auto_1771067909",
                label: "영웅 각성 2",
                transcript: "네가…. 이렇게까지 하는 이유가 있겠지? 하하하하!",
                audio: "ondal/ondal (7).mp3"
            }
        ]
    },
        {
        id: "ondal_dark",
        name: "온달",
        element: "dark",
        title: "영원한 방랑자",
        image: "ondal/dark_ondal.png",
        voices: [
                        {
                id: "v_auto_1771068780",
                label: "자기소개 1",
                transcript: "이름이라, 굳이 말하지 않아도 알겠지. 너라면.",
                audio: "ondal/dark_ondal.mp3"
            },
                        {
                id: "v_auto_1771068835",
                label: "영웅 영입 1",
                transcript: "나는 언제나, 너였다는데도.",
                audio: "ondal/dark_ondal (1).mp3"
            },
                        {
                id: "v_auto_1771068870",
                label: "영웅 영입 2",
                transcript: "반역이라, 그건 한 번이면 족하지.",
                audio: "ondal/dark_ondal (2).mp3"
            },
                        {
                id: "v_auto_1771069131",
                label: "영웅 초월 1",
                transcript: "나 좋자고 하는 일은 아니다.",
                audio: "ondal/dark_ondal (3).mp3"
            },
                        {
                id: "v_auto_1771069166",
                label: "영웅 초월 2",
                transcript: "아아, 알겠다, 알겠어. 보채기는.",
                audio: "ondal/dark_ondal (4).mp3"
            },
                        {
                id: "v_auto_1771069200",
                label: "영웅 초월 3",
                transcript: "원하는 건, 이것 뿐인가?",
                audio: "ondal/dark_ondal (5).mp3"
            }
        ]
    },
       {
        id: "lucilica_dark",
        name: "루실리카",
        element: "dark",
        title: "이상을 추구하는 의지",
        image: "lucilica/dark_lucil.png",
        voices: [
            {
                id: "v_auto_1771059355",
                label: "자기소개",
                transcript: "그대의 선택을 증명하겠어요.",
                audio: "lucilica/lucil.mp3"
            },
            {
                id: "v_auto_1771059593",
                label: "영웅 영입",
                transcript: "엘프의 맹세는 무겁다구요! 놓아주지 않을 거예요!",
                audio: "lucilica/lucil (1).mp3"
            },
            {
                id: "v_auto_1771059711",
                label: "영웅 초월 1",
                transcript: "어우, 좋아요! 그대의 기대에 부응하겠어요.",
                audio: "lucilica/lucil (2).mp3"
            },
                        {
                id: "v_auto_1771062375",
                label: "영웅 초월 2",
                transcript: "한층 더 나아갈 수 있겠군요.",
                audio: "lucilica/lucil (3).mp3"
            },
                        {
                id: "v_auto_1771062497",
                label: "영웅 각성 1",
                transcript: "이건… 그대의 권능인가요?",
                audio: "lucilica/lucil (4).mp3"
            },
                        {
                id: "v_auto_1771062681",
                label: "영웅 각성 2",
                transcript: "하…! 그대와의 인연이, 더 깊어진 듯하군요.",
                audio: "lucilica/lucil (5).mp3"
            },
                        {
                id: "v_auto_1771062784",
                label: "타이틀 콜",
                transcript: "Lord Of Heroes.",
                audio: "lucilica/lucil (6).mp3"
            },
                        {
                id: "v_auto_1771062869",
                label: "영웅 화면 1",
                transcript: "후회하지 않게 해 준다고 하셨죠? 그 말, 어디까지 믿어야 하나요?",
                audio: "lucilica/lucil (7).mp3"
            }
            
        ]    
    }
    
];

// Helper to get element color/icon if needed
const ELEMENT_STYLES = {
    water: { color: "#4facfe", icon: "💧" },
    fire: { color: "#fa709a", icon: "🔥" },
    earth: { color: "#43e97b", icon: "🌿" },
    light: { color: "#fee140", icon: "✨" },
    dark: { color: "#764ba2", icon: "🌑" }
};
