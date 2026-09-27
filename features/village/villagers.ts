export type Line = { en: string; ja: string };
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
  {
    id: "wren", name: line("Wren", "レン"), color: "#f4c3d4", ink: "#86596c",
    greeting: line("Hello, lovely! Our little clouds will be down for crumbs soon.", "こんにちは！小さな雲みたいな鳥たち、もうすぐ降りてくるよ。"),
    ambient: [
      line("Twelve little beaks. I count them every time.", "小さなくちばしが十二。毎回、数えちゃう。"),
      line("One lap of the village, then a tiny picnic.", "村をひと回りしたら、小さなピクニック。"),
      line("They always remember to say thank you.", "みんな、ありがとうを忘れないの。"),
    ],
    chat: [line("Here, some sourdough crumbs. Scatter a little and watch their wings!", "サワードウのパンくずをどうぞ。少し撒いて、羽を見ていてね！")],
    rain: line("A little rain makes their feathers look like pearls.", "雨にぬれると、羽が真珠みたいね。"),
    dusk: line("One last picnic before the stars come out.", "星が出る前に、もう一度ピクニック。"),
  },
];
