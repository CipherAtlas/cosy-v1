import * as T from "three";
import type { VillageLife } from "./life";
import type { Collider } from "./environment";
import type { Weather } from "./places";

type Line = { en: string; ja: string };
const line = (en: string, ja: string): Line => ({ en, ja });

export const VILLAGERS = [
  {
    id: "pip", name: line("Pip", "ピップ"), color: "#a5dfef", ink: "#3f607e",
    greeting: line("Oh! A new walking buddy. Excellent.", "あっ！お散歩仲間だ。やったね。"),
    ambient: [
      line("That pebble looks like a potato. A keeper.", "この小石、じゃがいもみたい。宝物にしよう。"),
      line("Taking the scenic route. Again.", "また、景色のいい遠回り。"),
      line("One day I'll learn to whistle. Not today.", "いつか口笛を吹けるはず。今日はまだだけど。"),
      line("Maple says my pockets are a tiny museum.", "メープルがね、ぼくのポケットは小さな博物館だって。"),
    ],
    chat: [
      line("I found a heart-shaped leaf! You can have it. I've got six.", "ハートの葉っぱ、見つけた！あげるよ。あと六枚あるから。"),
      line("I'm mapping all the best puddles. Very important work.", "すてきな水たまりの地図を作ってるの。大事なお仕事だよ。"),
      line("Moss named a snail after me. We've become quite close.", "モスがカタツムリにぼくの名前をつけたんだ。もう親友だよ。"),
      line("If you get lost, find me. We can be lost together!", "迷ったら、ぼくを探して。一緒に迷子になろう！"),
      line("No grand adventures today? A little wander counts.", "大冒険じゃなくても、ちょっと歩けば立派な冒険だよ。"),
    ],
    rain: line("Puddle season! Excellent splashing weather.", "水たまりの季節だ！水遊びにぴったりだね。"),
    dusk: line("First star gets a wish. I'm wishing for bigger pockets.", "一番星にお願いしよう。もっと大きなポケットを。"),
  },
  {
    id: "maple", name: line("Maple", "メープル"), color: "#ffdab9", ink: "#945d49",
    greeting: line("There you are! I saved you the warmest bun.", "来てくれたのね！一番あったかいパン、とってあるよ。"),
    ambient: [
      line("Just checking on the bread. With my mouth.", "パンの様子を見なくちゃ。ひと口食べてね。"),
      line("A wonky biscuit is still a good biscuit.", "形がへんでも、おいしいビスケットだよ。"),
      line("Pip asked for a pocket-sized pie. Challenge accepted.", "ピップがポケットに入るパイだって。作ってみよう！"),
      line("A pinch of cinnamon. A rather large pinch.", "シナモンをひとつまみ。大きめのひとつまみ。"),
    ],
    chat: [
      line("My sourdough starter is called Crumb. He's very dramatic.", "パン種の名前はクラム。とっても気分屋さんなの。"),
      line("The secret ingredient is butter. The other secret is more butter.", "隠し味はバター。もう一つの隠し味もバター。"),
      line("Luma brings the tea, I bring the biscuits. A perfect little treaty.", "ルマがお茶、私がビスケット。すてきな約束でしょ。"),
      line("You don't need a reason to sit by the fire. Or a second bun.", "焚き火で休むのに理由はいらないよ。パンのおかわりにもね。"),
      line("Today's loaf came out sideways. We're calling it rustic.", "今日のパン、横にふくらんじゃった。素朴な味ってことで。"),
    ],
    rain: line("Rain on the roof, bread in the oven. That's a good day.", "屋根には雨、オーブンにはパン。いい一日だね。"),
    dusk: line("Last batch! Well... last batch before the last batch.", "これが最後のひと焼き！の、その一つ前かな。"),
  },
  {
    id: "moss", name: line("Moss", "モス"), color: "#c8e6a6", ink: "#586b40",
    greeting: line("Shh... the seedlings are napping. Hello, though.", "しーっ、苗がお昼寝中。こんにちは、小さな声でね。"),
    ambient: [
      line("Grow at your own pace, little sprout.", "小さな芽さん、自分のペースで育ってね。"),
      line("That's not a weed. That's a surprise guest.", "雑草じゃないよ。ふらっと来たお客さま。"),
      line("The fern has a new leaf. I am very proud.", "シダに新しい葉っぱが。とっても誇らしい。"),
      line("Dear snails: please use the path. Love, Moss.", "カタツムリさんへ。道を歩いてね。モスより。"),
    ],
    chat: [
      line("I say good morning to every plant. It takes until lunch.", "全部の植物におはようって言うと、お昼になるんだ。"),
      line("This is my brave face. A butterfly landed on my nose earlier.", "これ、勇敢な顔。さっき鼻にチョウが止まったから。"),
      line("Pip brings me odd little stones. The thyme seems to like them.", "ピップが変な形の石をくれるの。タイムも気に入ったみたい。"),
      line("You can just be here, you know. The trees do it all day.", "ただここにいてもいいんだよ。木は一日中そうしてる。"),
      line("I planted one strawberry for me and twelve for the birds. Fair enough.", "イチゴは自分に一つ、鳥たちに十二。ちょうどいいね。"),
    ],
    rain: line("The garden ordered a drink. Excellent service.", "庭がお水を頼んだの。すばらしいサービスだね。"),
    dusk: line("Tucking the garden in. Sleep well, little leaves.", "庭を寝かしつけてるの。葉っぱさん、おやすみ。"),
  },
  {
    id: "luma", name: line("Luma", "ルマ"), color: "#d6c7fa", ink: "#80576f",
    greeting: line("Oh, lovely. The spare teacup was hoping for you.", "まあ、うれしい。空いてるカップも待ってたのよ。"),
    ambient: [
      line("Cloud report: one sleepy sheep, two dumplings.", "雲の観察日記。眠い羊が一匹、おだんごが二つ。"),
      line("This tea needs a biscuit-shaped companion.", "このお茶には、ビスケットの形をしたお友だちが必要ね。"),
      line("A very busy afternoon of doing very little.", "何もしないことで、とっても忙しい午後。"),
      line("The kettle is singing in a key of its own.", "やかんが自分だけの音階で歌ってる。"),
    ],
    chat: [
      line("Today's tea is called 'just five more minutes.' Refills encouraged.", "今日のお茶は『あと五分だけ』。おかわり大歓迎よ。"),
      line("Moss apologizes to the mint before picking it. I do too, now.", "モスはミントを摘む前にごめんねって。私も言うようになったの。"),
      line("I tried reading tea leaves. Mine said: wash the cup.", "茶葉で占ってみたの。結果は『カップを洗いましょう』。"),
      line("You may borrow my favourite cloud. Please return it by sunset.", "お気に入りの雲、貸してあげる。日暮れまでに返してね。"),
      line("Stay a little. You don't have to have anything clever to say.", "もう少しここにいて。気の利いた話なんて、なくていいの。"),
    ],
    rain: line("The rain is stirring the pond. How thoughtful.", "雨が池をかき混ぜてる。気が利くわね。"),
    dusk: line("A cup for me, a cup for you, and one for the moon.", "私に一杯、あなたに一杯、お月さまにも一杯。"),
  },
];

/** DOM bubbles follow world anchors without sending frame updates through React. */
export class VillagerDialogue {
  private layer = document.createElement("div");
  private announcement = document.createElement("span");
  private language: "en" | "ja" = "en";
  private enabled = false;
  private nearest = -1;
  private clock = 0;
  private width = 0;
  private height = 0;
  private anchor = new T.Vector3();
  private projected = new T.Vector3();
  private ray = new T.Ray();
  private hit = new T.Vector3();
  private boxes: T.Box3[];
  private bubbles;

  constructor(host: HTMLElement, life: VillageLife, colliders: Collider[], private onTalk: () => void) {
    this.layer.className = "v-villager-dialogue";
    this.layer.hidden = true;
    this.layer.setAttribute("role", "group");
    this.announcement.className = "sr-only";
    this.announcement.setAttribute("aria-live", "polite");
    this.announcement.setAttribute("aria-atomic", "true");
    this.bubbles = life.residents.map((resident, index) => {
      const profile = VILLAGERS[index];
      const element = document.createElement("div");
      element.className = "v-villager-bubble";
      element.dataset.villager = profile.id;
      element.style.setProperty("--villager-color", profile.color);
      element.hidden = true;
      const text = document.createElement("p");
      const footer = document.createElement("div");
      footer.className = "v-villager-footer";
      const name = document.createElement("span");
      const button = document.createElement("button");
      button.type = "button";
      const buttonLabel = document.createElement("span");
      const shortcut = document.createElement("kbd");
      shortcut.textContent = "F";
      shortcut.setAttribute("aria-hidden", "true");
      button.append(buttonLabel, shortcut);
      button.addEventListener("click", () => this.talk(index));
      button.addEventListener("keydown", event => {
        if (event.key.toLowerCase() === "f" && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault(); event.stopPropagation(); this.talk(index);
        }
      });
      footer.append(name, button);
      element.append(text, footer);
      this.layer.append(element);
      return { resident, profile, element, text, name, button, buttonLabel, line: profile.greeting,
        greetingSeen: false, nextAmbient: index * 2, ambient: 0, chat: 0, until: 0, talkingUntil: 0,
        visible: false, distance: Infinity, x: 0, y: 0, width: 0, height: 0, measured: "" };
    });
    this.layer.append(this.announcement);
    host.append(this.layer);
    this.boxes = colliders.map(c => new T.Box3(
      new T.Vector3(c.x - c.w / 2, c.bottom ?? 0, c.z - c.d / 2),
      new T.Vector3(c.x + c.w / 2, c.top ?? 8, c.z + c.d / 2),
    ));
    this.setLanguage("en");
  }

  resize(width: number, height: number) { this.width = width; this.height = height; this.bubbles.forEach(b => { b.measured = ""; }); }

  setLanguage(language: "en" | "ja") {
    this.language = language;
    this.layer.lang = language;
    this.layer.setAttribute("aria-label", language === "ja" ? "村人との会話" : "Villager conversations");
    this.bubbles.forEach(b => {
      b.name.textContent = b.profile.name[language];
      b.text.textContent = b.line[language];
      b.buttonLabel.textContent = language === "ja" ? "話す" : "Chat";
      b.button.setAttribute("aria-label", language === "ja" ? `${b.profile.name.ja}と話す` : `Chat with ${b.profile.name.en}`);
      b.button.setAttribute("aria-keyshortcuts", "F");
    });
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.layer.hidden = !enabled;
    if (!enabled) {
      this.nearest = -1;
      this.announcement.textContent = "";
      this.bubbles.forEach(b => {
        b.element.hidden = true; b.visible = false; b.talkingUntil = 0; b.resident.chatting = false;
      });
    }
  }

  private say(index: number, text: Line, seconds: number) {
    const b = this.bubbles[index];
    b.line = text;
    b.text.textContent = text[this.language];
    b.until = this.clock + seconds;
    b.nextAmbient = b.until + 5 + index * 1.3;
  }

  talk(index = this.nearest) {
    const b = this.bubbles[index];
    if (!this.enabled || !b?.visible || b.distance > 4.5 || index !== this.nearest) return;
    this.onTalk();
    this.say(index, b.profile.chat[b.chat++ % b.profile.chat.length], 10);
    b.talkingUntil = this.clock + 10;
    b.resident.chatting = true;
    this.announcement.textContent = `${b.profile.name[this.language]}: ${b.line[this.language]}`;
  }

  update(delta: number, camera: T.Camera, player: T.Vector3, weather: Weather) {
    if (!this.enabled || !this.width || !this.height) return;
    this.clock += delta;
    this.nearest = -1;
    const candidates: number[] = [];
    this.bubbles.forEach((b, index) => {
      b.distance = b.resident.root.position.distanceTo(player);
      b.resident.chatting = b.distance <= 5.5 && this.clock < b.talkingUntil;
      if (b.distance > 7) b.greetingSeen = false;
      this.anchor.copy(b.resident.root.position);
      this.anchor.y += 2.12 * b.resident.root.scale.y;
      this.projected.copy(this.anchor).project(camera);
      const distanceToCamera = this.anchor.distanceTo(camera.position);
      this.ray.origin.copy(camera.position);
      this.ray.direction.subVectors(this.anchor, camera.position).normalize();
      b.visible = b.distance < 15 && this.projected.z > -1 && this.projected.z < 1
        && Math.abs(this.projected.x) < 1 && Math.abs(this.projected.y) < 1
        && !this.boxes.some(box => this.ray.intersectBox(box, this.hit) && this.hit.distanceTo(camera.position) < distanceToCamera - .2);
      if (!b.visible) { b.element.hidden = true; b.button.hidden = true; return; }
      if (b.distance < 4.5 && (this.nearest < 0 || b.distance < this.bubbles[this.nearest].distance)) this.nearest = index;
      if (!b.greetingSeen && b.distance < 2.5) {
        b.greetingSeen = true;
        this.say(index, b.profile.greeting, 8);
        b.talkingUntil = this.clock + 5;
        b.resident.chatting = true;
      } else if (this.clock >= b.nextAmbient && this.clock >= b.talkingUntil) {
        const turn = b.ambient++;
        const text = weather !== "golden" && turn % 2 === 0 ? b.profile[weather]
          : b.profile.ambient[turn % b.profile.ambient.length];
        this.say(index, text, 8);
      }
      b.x = (this.projected.x * .5 + .5) * this.width;
      b.y = (-this.projected.y * .5 + .5) * this.height;
      candidates.push(index);
    });
    // Keep at most two bubbles, preferring the nearest speaker; hide overlapping or clipped ones.
    const placed: { left: number; right: number; top: number; bottom: number }[] = [];
    candidates.sort((a, b) => this.bubbles[a].distance - this.bubbles[b].distance).forEach(index => {
      const b = this.bubbles[index];
      const canChat = index === this.nearest;
      b.button.hidden = !canChat;
      b.element.hidden = false;
      const measureKey = `${this.language}:${b.line.en}:${canChat}`;
      if (b.measured !== measureKey) {
        b.width = b.element.offsetWidth; b.height = b.element.offsetHeight; b.measured = measureKey;
      }
      const left = T.MathUtils.clamp(b.x - b.width / 2, 12, this.width - b.width - 12);
      const top = Math.max(76, b.y - b.height - 14);
      const rect = { left, right: left + b.width, top, bottom: Math.max(b.y, top + b.height + 8) };
      const overlaps = placed.some(p => rect.left < p.right + 12 && rect.right > p.left - 12 && rect.top < p.bottom + 12 && rect.bottom > p.top - 12);
      b.visible = placed.length < 2 && !overlaps && b.y > 90 && b.y < this.height - 100
        && (canChat || this.clock < b.until);
      b.element.hidden = !b.visible;
      if (!b.visible) {
        if (canChat) this.nearest = -1;
        return;
      }
      b.element.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
      b.element.style.setProperty("--tail-x", `${T.MathUtils.clamp(b.x - left, 16, b.width - 16)}px`);
      placed.push(rect);
    });
  }

  dispose() { this.setEnabled(false); this.layer.remove(); }
}
