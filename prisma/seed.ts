import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.scoringProfile.createMany({
    data: [
      {
        name: "素材の質重視",
        wAudience: 25,
        wGenre: 15,
        wEr: 15,
        wPhoto: 30,
        wNotJaded: 10,
        wActivity: 5,
        wFollower: 0,
      },
      {
        name: "UGC量重視",
        wAudience: 25,
        wGenre: 25,
        wEr: 25,
        wPhoto: 10,
        wNotJaded: 10,
        wActivity: 5,
        wFollower: 0,
      },
      {
        name: "リーチ重視",
        wAudience: 20,
        wGenre: 15,
        wEr: 20,
        wPhoto: 10,
        wNotJaded: 5,
        wActivity: 5,
        wFollower: 25,
      },
    ],
  });

  await prisma.complianceProfile.createMany({
    data: [
      {
        name: "食品(薬機法あり)",
        ngWords: "治る,効く,健康になる,デトックス,若返り,疲労回復,病気改善",
        okWords: "ホッと一息,ほっとする味,香ばしい,リラックスタイムに",
      },
      {
        name: "化粧品(薬機法あり)",
        ngWords: "シミが消える,アンチエイジング,若返る,シワがなくなる",
        okWords: "うるおいを与える,肌をととのえる,メイクのりが良い",
      },
      {
        name: "サプリ(薬機法あり)",
        ngWords: "病気を治す,診断,予防,治癒力を上げる",
        okWords: "毎日の健康習慣に,栄養補給に",
      },
      {
        name: "一般(雑貨・家電)",
        ngWords: "",
        okWords: "",
      },
    ],
  });

  console.log("Seed complete: 3 ScoringProfile / 4 ComplianceProfile created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
