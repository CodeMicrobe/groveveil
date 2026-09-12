import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Groveveil database...");

  // 1. Seed Tree Species with Relational Aliases
  const speciesList = [
    {
      commonName: "Mango",
      scientificName: "Mangifera indica",
      aliases: ["Aam", "Mango Tree", "Indian Mango"],
    },
    {
      commonName: "Neem",
      scientificName: "Azadirachta indica",
      aliases: ["Margosa", "Indian Lilac", "Nimba"],
    },
    {
      commonName: "Banyan",
      scientificName: "Ficus benghalensis",
      aliases: ["Vat Vriksha", "Bargad", "Indian Banyan"],
    },
    {
      commonName: "Peepal",
      scientificName: "Ficus religiosa",
      aliases: ["Sacred Fig", "Bodhi Tree", "Ashwattha"],
    },
    {
      commonName: "Teak",
      scientificName: "Tectona grandis",
      aliases: ["Sagwan", "Burmese Teak"],
    },
  ];

  for (const s of speciesList) {
    const species = await prisma.treeSpecies.upsert({
      where: { scientificName: s.scientificName },
      update: { commonName: s.commonName },
      create: {
        commonName: s.commonName,
        scientificName: s.scientificName,
        isActive: true,
      },
    });

    for (const alias of s.aliases) {
      await prisma.treeSpeciesAlias.upsert({
        where: {
          speciesId_alias: {
            speciesId: species.id,
            alias,
          },
        },
        update: {},
        create: {
          speciesId: species.id,
          alias,
          language: "en",
        },
      });
    }
  }

  console.log(`✅ Seeded ${speciesList.length} botanical species with aliases.`);

  // 2. Seed Initial MVP Achievement Definitions
  const achievements = [
    {
      key: "first_tree",
      name: "First Tree",
      description: "Plant your first verified tree.",
      category: "MILESTONE" as const,
      criteriaType: "VERIFIED_TREE_COUNT",
      targetValue: 1,
      iconUrl: "badge_first_tree",
      gpgId: "CgkI_first_tree",
    },
    {
      key: "tree_planter_10",
      name: "Tree Planter",
      description: "Plant 10 verified trees.",
      category: "MILESTONE" as const,
      criteriaType: "VERIFIED_TREE_COUNT",
      targetValue: 10,
      iconUrl: "badge_tree_planter_10",
      gpgId: "CgkI_tree_planter_10",
    },
    {
      key: "tree_planter_25",
      name: "Tree Planter II",
      description: "Plant 25 verified trees.",
      category: "MILESTONE" as const,
      criteriaType: "VERIFIED_TREE_COUNT",
      targetValue: 25,
      iconUrl: "badge_tree_planter_25",
      gpgId: "CgkI_tree_planter_25",
    },
    {
      key: "forest_builder_100",
      name: "Forest Builder",
      description: "Plant 100 verified trees.",
      category: "MILESTONE" as const,
      criteriaType: "VERIFIED_TREE_COUNT",
      targetValue: 100,
      iconUrl: "badge_forest_builder_100",
      gpgId: "CgkI_forest_builder_100",
    },
    {
      key: "biodiversity_5",
      name: "Biodiversity",
      description: "Plant 5 different verified tree species.",
      category: "MILESTONE" as const,
      criteriaType: "DISTINCT_SPECIES_COUNT",
      targetValue: 5,
      iconUrl: "badge_biodiversity",
      gpgId: "CgkI_biodiversity_5",
    },
  ];

  for (const a of achievements) {
    await prisma.achievementDefinition.upsert({
      where: { key: a.key },
      update: {
        name: a.name,
        description: a.description,
        targetValue: a.targetValue,
        gpgId: a.gpgId,
      },
      create: a,
    });
  }

  console.log(`✅ Seeded ${achievements.length} core milestone achievement definitions.`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
