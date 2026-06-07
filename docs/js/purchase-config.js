window.COSMIC_LENS_PURCHASE_CONFIG = {
  provider: "stripe_payment_links",
  currency: "CNY",
  successUrl: "https://mokangmedical.github.io/cosmic-lens/purchase-success.html",
  supportEmail: "",
  plans: {
    personal: {
      id: "personal",
      name: "个人永久版",
      price: 99,
      subtitle: "适合个人系统学习",
      paymentLink: "",
      benefits: [
        "120 门课程目录与正文永久访问",
        "前 40 节 A 级规格课程音频",
        "练习题、思维卡片与阶段路线图",
        "后续课程与音频补齐时免费更新"
      ]
    },
    supporter: {
      id: "supporter",
      name: "支持者版",
      price: 199,
      subtitle: "适合深度学习者与早期支持者",
      paymentLink: "",
      featured: true,
      benefits: [
        "包含个人永久版全部权益",
        "支持项目继续生成高质量音频与内容",
        "优先获得新阶段课程更新",
        "支持者身份可用于后续社群/活动识别"
      ]
    },
    institution: {
      id: "institution",
      name: "机构授权",
      price: 999,
      subtitle: "适合学校、机构与学习小组",
      paymentLink: "",
      benefits: [
        "最多 10 人内部学习使用",
        "包含支持者版全部权益",
        "可用于课程研讨、读书会与训练营",
        "支持开具机构采购说明与授权记录"
      ]
    }
  }
};
