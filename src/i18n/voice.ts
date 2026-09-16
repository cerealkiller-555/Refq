// ============================================================
// رِفق — صوت رِفق (كل نصوص الواجهة في مكان واحد)
// قواعد الصوت: هادئ، مشجع، بلا لوم، بلا أرقام على القلب،
// بلا "أنتِ متأخرة"، بلا streaks. الراحة جزء من الخطة.
// ============================================================

export const voice = {
  today: {
    hint: 'خطوة واحدة تكفي للبداية — ومش لازم تكوني مثالية.',
    energy: {
      title: 'طاقة اليوم',
      question: 'كيف طاقتك الآن؟',
      low: '🔴 منخفضة',
      medium: '🟡 متوسطة',
      high: '🟢 عالية',
      lightDay: 'أريد يومًا خفيفًا',
      notePlaceholder: 'ملاحظة (اختياري)…',
      saved: 'سجلنا طاقة اليوم 🤍 تعدليها في أي وقت.',
      needLevelFirst: 'اختاري مستوى الطاقة أولًا، وبعدين فعّلي اليوم الخفيف.'
    },
    priorities: {
      title: 'أهم أولويات اليوم',
      empty: 'لا أولويات الآن — أضيفي مهمة صغيرة أو خذي نفسًا 🤍'
    },
    suggestion: {
      title: '✨ ماذا أفعل الآن؟',
      question: 'كم عندك من الوقت؟',
      minutes: 'دقيقة',
      start: 'ابدئي',
      again: 'اقتراح آخر',
      inProgressBadge: 'جارية'
    },
    period: {
      between: 'أنتِ الآن بين {current} و{next}',
      after: 'أنتِ الآن بعد {current}',
      before: 'الآن قبل {next} (ليل)',
      nightOpen: 'الآن ليل — وقت مفتوح 🌙',
      remaining: '{next} بعد {duration} 🤍',
      afterNext: 'بعد {next}',
      finalGuard: 'مواقيت اليوم من خدمة مواقيت الصلاة — تُحدَّث تلقائيًا، والصلوات لا تُقدَّم ولا تُحرَّك أبدًا.'
    },
    quickCapture: {
      title: 'التقاط سريع',
      placeholder: 'خاطرة أو مهمة… اكتبيها واضغطي Enter'
    },
    tasks: {
      title: 'مهامي الحالية',
      empty: 'لا مهام مفتوحة الآن — يوم خفيف 🤍'
    }
  },
  planning: {
    tasksTitle: 'المهام',
    addTitle: 'مهمة جديدة',
    fields: {
      title: 'اسم المهمة',
      importance: 'الأهمية',
      urgency: 'الإلحاح',
      duration: 'المدة المتوقعة (دقائق)',
      deadline: 'الموعد النهائي (اختياري)',
      energy: 'الطاقة المطلوبة (اختياري)',
      save: 'إضافة المهمة'
    },
    importanceLabels: { high: 'مهمة', low: 'عادية' } as Record<string, string>,
    urgencyLabels: { high: 'عاجلة', low: 'غير عاجلة' } as Record<string, string>,
    energyLabels: { low: 'خفيفة', medium: 'متوسطة', high: 'عميقة' } as Record<string, string>,
    empty: 'لا مهام بعد — أضيفي أول مهمة بهدوء.',
    doneTitle: 'أُنجزت',
    calendar: {
      tabs: { tasks: '📋 المهام', day: '📅 اليوم', week: '🗓️ الأسبوع' },
      addEventTitle: 'حدث جديد',
      eventName: 'اسم الحدث',
      kind: 'النوع',
      kindFixed: 'ثابت — لا يتحرك أبدًا',
      kindFlexible: 'مرن — وقت مخصص لمهمة',
      date: 'التاريخ',
      time: 'وقت البداية',
      duration: 'المدة (دقائق)',
      note: 'ملاحظة (اختياري)',
      save: 'إضافة الحدث',
      kindLabels: { fixed: 'ثابت', flexible: 'مرن' } as Record<string, string>,
      emptyDay: 'لا أحداث في هذا اليوم — يوم مفتوح لك 🤍',
      emptyWeek: 'أسبوعك فاضي — أضيفي أول حدث بهدوء.',
      prev: 'السابق',
      next: 'التالي',
      today: 'اليوم',
      dayNames: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'] as string[],
      schedule: {
        button: 'جدولة 📅',
        title: 'جدولة المهمة في التقويم',
        date: 'اليوم',
        time: 'الساعة',
        confirm: 'حدّدها',
        cancel: 'بدون جدولة',
        done: 'المهمة اتحطت في التقويم 📅 تقدري تغيريها في أي وقت.'
      },
      recovery: {
        banner: 'فيه مهام كانت مجدولة في أيام فاتت. نعيد توزيعها على الأيام الجاية بلطف؟',
        button: 'أعد التوزيع بلطف',
        applied: 'تمت إعادة التوزيع 🤍 مفيش ضغط، والثوابت ما اتحركتش أبدًا.',
        dismiss: 'شكرًا، دلوقتي كفاية'
      },
      scheduledChip: 'مجدولة'
    }
  },
  heart: {
    title: '🤍 القلب',
    tabs: { athar: 'أثر', search_heart: 'فتش عن قلبك', waqfa: 'وقفة', muhasaba: 'محاسبة', sharia: 'نصوص شرعية' },
    athar: {
      title: 'أثر — ماذا بعد ما أنهيتِ خطوة؟',
      hint: 'خصّيصة صغيرة بعد إنجاز خطوة تعليمية — بلا ضغط.',
      prompt: 'كيف شعرتِ بعد ما أنهيتِ الخطوة؟',
      benefit: 'هل خرجتِ بفائدة أو فكرة؟',
      save: 'سجّلي الأثر',
      done: 'سجّلي أثرك 🤍',
      skip: 'مش دلوقتي',
      afterItem: 'بعد إنهاء: {item}'
    },
    search_heart: {
      title: 'فتش عن قلبك',
      hint: 'سؤال دوري هادئ — مجرد تأمل، بلا تقييم.',
      prompt: 'ماذا تحتاجين الآن؟',
      options: ['راحة', 'تركيز', 'دفء', 'وضوح', 'شيء آخر'],
      save: 'سجّلي',
      saved: 'سجّلي ما تحتاجينه 🤍',
      skip: 'تخطي'
    },
    waqfa: {
      title: 'وقفة — لحظة تأمل أسبوعية',
      hint: 'خصيصة أسبوعية — تُطرح مرة واحدة في الأسبوع.',
      prompt: 'كيف كان أسبوعك؟',
      wins: 'أبرز نجاح أو لحظة جميلة؟',
      challenge: 'ما أصعب شيء واجهتِه؟',
      nextWeek: 'ما أولويتك للأسبوع الجاي؟',
      save: 'سجّلي الوقفة',
      saved: 'سجّلي وقفتك الأسبوعية 🤍',
      skip: 'مش دلوقتي'
    },
    muhasaba: {
      title: 'محاسبة — تأمل اختياري',
      hint: 'محاسبة ذاتية هادئة — بدون أحكام.',
      prompt: 'ماذا فعلتِ اليوم لترضين عن نفسك؟',
      improvement: 'ما الذي تتمنين تحسينه بهدوء؟',
      save: 'سجّلي المحاسبة',
      saved: 'سجّلي محاسبتك 🤍',
      skip: 'مش دلوقتي'
    },
    sharia: {
      title: 'نصوص شرعية',
      hint: 'نص شرعي يلمس قلبك — آية أو حديث أو فائدة، والمصدر دائمًا مذكور.',
      addText: 'أضيفي نص',
      kind: 'النوع',
      text: 'النص',
      source: 'المصدر',
      linkPathLabel: 'مرتبط بمسار',
      noPath: 'بدون ربط',
      kinds: {
        ayah: 'آية',
        hadith: 'حديث',
        scholar_quote: 'قول عالم',
        faida: 'فائدة',
        tarif: 'تعريف'
      } as Record<string, string>,
      save: 'حفظ',
      cancel: 'إلغاء',
      empty: 'لا نصوص بعد — أضيفي آية أو حديث أو فائدة 🤍',
      linkedPath: 'مرتبط بمسار: {path}'
    },
    history: 'السجل',
    noHistory: 'لا سجل بعد — سجّلي أول تأمل 🤍',
    todayDone: 'سجّلي اليوم — تقدري تعودي غدًا 🤍'
  },
  learning: {
    title: '🎓 رحلتي',
    addPathTitle: 'مسار جديد',
    pathName: 'اسم المسار (مثل: مادة المحاسبة)',
    pathType: 'نوع المسار',
    types: {
      university: '🎓 جامعة',
      course: '📚 كورس',
      religious_science: '🕌 علم شرعي',
      book: '📖 كتاب',
      quran: '📖 قرآن'
    } as Record<string, string>,
    addPath: 'أضيفي المسار',
    nextStepTitle: 'خطوتك القادمة',
    nextStepHint: 'ما الذي ستُكملينه بعد ذلك في هذا المسار؟',
    noNext: 'مافيش عناصر جاية هنا — كله تمام 🤍',
    itemsTitle: 'عناصر المسار',
    addItemPlaceholder: 'عنصر جديد… (مثل: محاضرة 3)',
    addItem: 'إضافة',
    doneCount: 'مُنجز',
    sessions: 'جلسات',
    addSession: 'سجّلي جلسة',
    sessionOf: 'جلسة على',
    empty: 'ابدئي رحلتك بإضافة مسار تعليمي صغير — خطوة واحدة تكفي للبداية 🤍',
    emptyItems: 'لا عناصر بعد — أضيفي أول خطوة بهدوء.',
    progressLabel: 'أُنجز {done} من {total}',
    pause: 'إيقاف مؤقت',
    activate: 'متابعة',
    noActiveHint: 'أضيفي مسارًا نشطًا وستظهر خطواته هنا.'
  },
  vault: {
    title: '🧠 المعرفة',
    newNote: 'ملاحظة جديدة',
    searchPlaceholder: 'ابحثي في الملاحظات والعناوين…',
    allFolder: 'الكل',
    unfiled: 'غير مصنّفة',
    newFolder: 'مجلد جديد',
    foldersTitle: 'المجلدات',
    folderPlaceholder: 'اسم المجلد',
    save: 'حفظ',
    cancel: 'إلغاء',
    edit: 'تعديل',
    deleteConfirm: 'نحذف هذه الملاحظة؟ لا رجوع بعدها.',
    noteTitle: 'عنوان الملاحظة',
    noteBody: 'المحتوى (Markdown — [[روابط]] و#وسوم تعمل)',
    backlinks: 'روابط عائدة',
    noBacklinks: 'لا روابط عائدة بعد — اذكريها بـ[[العنوان]] في ملاحظة أخرى.',
    openBacklink: 'افتحيها',
    tagsLabel: 'وسوم',
    linkedPathItem: 'مرتبطة بخطوة: {item}',
    exportZip: '⬇ تصدير الكل (zip)',
    exportNote: '⬇ .md',
    rebuild: 'إعادة بناء الفهرس',
    rebuilt: 'أُعيد بناء الفهرس من الـMarkdown — المصدر دائمًا هو النص نفسه 🤍',
    noNotes: 'لا ملاحظات هنا — اكتبي أول فائدة أو خاطرة 🤍',
    noResults: 'لا نتائج مطابقة — جرّبي كلمة أخرى.',
    notesCount: '{count} ملاحظة'
  },
  common: {
    complete: 'إنجاز',
    reopen: 'إعادة فتح',
    delete: 'حذف',
    edit: 'تعديل',
    save: 'حفظ',
    cancel: 'إلغاء'
  }
};

/** تحية حسب الوقت — هادئة وبلا ضغط */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'صباح الخير 🌤';
  if (hour >= 12 && hour < 17) return 'نهارك هادئ 🌿';
  if (hour >= 17 && hour < 21) return 'مساء الخير 🌆';
  return 'ليلة طيبة 🌙';
}