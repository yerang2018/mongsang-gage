import fs from "node:fs/promises";
import path from "node:path";

type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

// 증서 이미지에 쓸 글꼴. 구글 폰트에서 "이 글자들만" 담은 작은 파일을 받아 옴 (한글 글꼴 전체는 너무 큼)
export async function loadGoogleFont(family: string, weight: 400 | 700, text: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
  if (!src) throw new Error(`글꼴을 못 받았어요: ${family}`);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`글꼴을 못 받았어요: ${family}`);
  return res.arrayBuffer();
}

// 인터넷이 안 되면 프로젝트에 들어 있는 Pretendard로 대신
async function fallbackFont(): Promise<ArrayBuffer> {
  const buf = await fs.readFile(path.join(process.cwd(), "assets/fonts/Pretendard-Bold.otf"));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

// 그림(증서·카톡 미리보기)도 화면과 같은 고운돋움 하나만. Title·Cute 이름은 그림 코드에서 쓰는 자리 이름일 뿐
// 고운돋움은 굵기가 하나라 700 자리에도 같은 글꼴을 넣어 둠
export async function certificateFonts(text: string, classical = false): Promise<OgFont[]> {
  try {
    if (classical) {
      const [title, body] = await Promise.all([
        loadGoogleFont("Noto Serif KR", 400, text),
        loadGoogleFont("Gowun Batang", 400, text),
      ]);
      return [
        { name: "Title", data: title, weight: 400, style: "normal" },
        { name: "Body", data: body, weight: 400, style: "normal" },
      ];
    }
    const dodum = await loadGoogleFont("Gowun Dodum", 400, text);
    return [
      { name: "Title", data: dodum, weight: 400, style: "normal" },
      { name: "Title", data: dodum, weight: 700, style: "normal" },
      { name: "Cute", data: dodum, weight: 400, style: "normal" },
    ];
  } catch (err) {
    console.warn("certificate font fallback", err);
    if (classical) {
      try {
        const data = await loadGoogleFont("Gowun Batang", 400, text);
        return [{ name: "Title", data, weight: 400, style: "normal" }, { name: "Body", data, weight: 400, style: "normal" }];
      } catch { /* 네트워크가 없으면 로컬 글꼴로 내려받기 기능 유지 */ }
    }
    const data = await fallbackFont();
    return [
      { name: "Title", data, weight: 400, style: "normal" },
      { name: "Title", data, weight: 700, style: "normal" },
      { name: "Cute", data, weight: 400, style: "normal" },
      { name: "Body", data, weight: 400, style: "normal" },
    ];
  }
}
