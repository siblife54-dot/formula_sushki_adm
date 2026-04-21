(function () {
  "use strict";

  var state = {
    lessons: [],
    selectedLesson: null,
    blocks: [],
    selectedBlockId: null,
    blockItems: [],
    quill: null
  };

  function getConfig() {
    return window.APP_CONFIG || {};
  }

  function getClient() {
    return window.getSupabaseClient();
  }

  async function fetchLessons() {
    var client = getClient();
    var config = getConfig();

    if (!client) throw new Error("Supabase client not initialized");

    var result = await client
      .from("lessons")
      .select("*")
      .eq("course_id", config.courseId)
      .order("day_number", { ascending: true });

    if (result.error) {
      console.error(result.error);
      throw new Error("Не удалось загрузить уроки");
    }

    return result.data || [];
  }

  async function fetchLessonBlocks(lessonDbId) {
    var client = getClient();

    if (!client) throw new Error("Supabase client not initialized");

    var result = await client
      .from("lesson_blocks")
      .select("*")
      .eq("lesson_id", lessonDbId)
      .order("sort_order", { ascending: true });

    if (result.error) {
      console.error(result.error);
      throw new Error("Не удалось загрузить блоки урока");
    }

    return result.data || [];
  }

  async function fetchBlockItems(blockId) {
    var client = getClient();
    if (!client) return [];

    var result = await client
      .from("lesson_block_items")
      .select("*")
      .eq("block_id", blockId)
      .order("sort_order", { ascending: true });

    if (result.error) {
      console.error(result.error);
      alert("Ошибка загрузки элементов блока");
      return [];
    }

    return result.data || [];
  }

  function renderLessonsList() {
    var lessonsList = document.getElementById("lessonsList");
    var selectedId = state.selectedLesson ? state.selectedLesson.id : null;

    lessonsList.innerHTML = state.lessons.map(function (lesson) {
      var isActive = selectedId === lesson.id;
      return [
        '<button class="admin-lesson-item' + (isActive ? ' active' : '') + '" data-lesson-db-id="' + lesson.id + '" type="button">',
        '<div><strong>' + escapeHtml(lesson.title || "Без названия") + '</strong></div>',
        '<div>lesson_id: ' + escapeHtml(lesson.lesson_id || "") + '</div>',
        '<div>День: ' + escapeHtml(String(lesson.day_number || "")) + '</div>',
        '</button>'
      ].join("");
    }).join("");
  }

  function renderEditor() {
    var empty = document.getElementById("editorEmpty");
    var panel = document.getElementById("editorPanel");

    if (!state.selectedLesson) {
      empty.hidden = false;
      panel.hidden = true;
      return;
    }

    empty.hidden = true;
    panel.hidden = false;

    var lesson = state.selectedLesson;

    document.getElementById("editorLessonTitle").textContent = lesson.title || "Урок";
    document.getElementById("lessonIdInput").value = lesson.lesson_id || "";
    document.getElementById("dayNumberInput").value = lesson.day_number || "";
    document.getElementById("titleInput").value = lesson.title || "";
    document.getElementById("subtitleInput").value = lesson.subtitle || "";

    renderBlocksList();
  }

  function renderBlocksList() {
    var blocksList = document.getElementById("blocksList");

    if (!state.blocks.length) {
      blocksList.innerHTML = '<div class="admin-empty">У этого урока пока нет блоков</div>';
      return;
    }

    blocksList.innerHTML = state.blocks.map(function (block, index) {
      return [
        '<div class="admin-block-item" data-block-id="' + block.id + '">',
        '<div><strong>Блок #' + (index + 1) + '</strong></div>',
        '<div>Тип: ' + escapeHtml(block.block_type || "") + '</div>',
        '<div>Порядок: ' + escapeHtml(String(block.sort_order || 0)) + '</div>',
        '<textarea class="admin-block-editor" data-block-id="' + block.id + '">' +
          escapeHtml(block.content_html || "") +
        '</textarea>',
        '<button class="btn btn-primary save-block-btn" data-block-id="' + block.id + '">Сохранить блок</button>',
        '</div>'
      ].join("");
    }).join("");
  }

  function initQuillEditor() {
    var editorElement = document.getElementById("quillEditor");
    if (!editorElement || state.quill) return;
    if (!window.Quill) return;

    state.quill = new window.Quill("#quillEditor", {
      theme: "snow",
      modules: {
        toolbar: [
          [{ header: [2, 3, false] }],
          ["bold", "italic", "underline"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "blockquote"],
          ["clean"]
        ]
      }
    });
  }

  function getNextBlockItemOrder() {
    if (!state.blockItems.length) return 1;
    return Math.max.apply(null, state.blockItems.map(function (item) {
      return item.sort_order || 0;
    })) + 1;
  }

  async function createTextItem() {
    if (!state.selectedBlockId) return null;

    var client = getClient();
    if (!client) return null;

    var result = await client
      .from("lesson_block_items")
      .insert({
        block_id: state.selectedBlockId,
        sort_order: 1,
        item_type: "text",
        text_html: "<p></p>"
      })
      .select()
      .single();

    if (result.error) {
      console.error(result.error);
      alert("Ошибка создания текстового элемента");
      return null;
    }

    state.blockItems.push(result.data);
    return result.data;
  }

  async function createVideoItem(videoId) {
    if (!state.selectedBlockId) return null;
    if (!videoId) return null;

    var client = getClient();
    if (!client) return null;

    var nextOrder = getNextBlockItemOrder();
    var result = await client
      .from("lesson_block_items")
      .insert({
        block_id: state.selectedBlockId,
        sort_order: nextOrder,
        item_type: "video",
        video_id: videoId
      })
      .select()
      .single();

    if (result.error) {
      console.error(result.error);
      alert("Ошибка создания видео");
      return null;
    }

    state.blockItems.push(result.data);
    return result.data;
  }

  async function createFileItem(fileLabel, fileId) {
    if (!state.selectedBlockId) return null;
    if (!fileLabel || !fileId) return null;

    var client = getClient();
    if (!client) return null;

    var nextOrder = getNextBlockItemOrder();
    var result = await client
      .from("lesson_block_items")
      .insert({
        block_id: state.selectedBlockId,
        sort_order: nextOrder,
        item_type: "file",
        file_label: fileLabel,
        file_id: fileId
      })
      .select()
      .single();

    if (result.error) {
      console.error(result.error);
      alert("Ошибка создания файла");
      return null;
    }

    state.blockItems.push(result.data);
    return result.data;
  }

  async function loadTextItem() {
    var textItem = state.blockItems.find(function (item) {
      return item.item_type === "text";
    });

    if (!textItem) {
      textItem = await createTextItem();
    }

    if (state.quill && textItem) {
      state.quill.root.innerHTML = textItem.text_html || "<p></p>";
    }

    return textItem;
  }

  async function saveTextItem() {
    if (!state.selectedBlockId || !state.quill) return;

    var textItem = state.blockItems.find(function (item) {
      return item.item_type === "text";
    });

    if (!textItem) {
      textItem = await createTextItem();
      if (!textItem) return;
    }

    var client = getClient();
    if (!client) return;

    var html = state.quill.root.innerHTML;
    var result = await client
      .from("lesson_block_items")
      .update({ text_html: html })
      .eq("id", textItem.id)
      .select()
      .single();

    if (result.error) {
      console.error(result.error);
      alert("Ошибка сохранения текста");
      return;
    }

    state.blockItems = state.blockItems.map(function (item) {
      return String(item.id) === String(result.data.id) ? result.data : item;
    });

    alert("Текст сохранён");
  }

  function loadVideoItem() {
    return state.blockItems.find(function (item) {
      return item.item_type === "video";
    }) || null;
  }

  function loadFiles() {
    return state.blockItems
      .filter(function (item) {
        return item.item_type === "file";
      })
      .sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
  }

  async function deleteItem(itemId) {
    var client = getClient();
    if (!client) return;

    var result = await client
      .from("lesson_block_items")
      .delete()
      .eq("id", itemId);

    if (result.error) {
      console.error(result.error);
      alert("Ошибка удаления");
      return;
    }

    state.blockItems = state.blockItems.filter(function (item) {
      return String(item.id) !== String(itemId);
    });

    renderContentSections();
  }

  function renderContentSections() {
    renderVideoSection();
    renderFilesSection();
  }

  function renderVideoSection() {
    var videoItem = loadVideoItem();
    var addVideoToggleBtn = document.getElementById("addVideoToggleBtn");
    var videoForm = document.getElementById("videoForm");
    var videoCard = document.getElementById("videoCard");

    if (!addVideoToggleBtn || !videoForm || !videoCard) return;

    if (videoItem) {
      addVideoToggleBtn.hidden = true;
      videoForm.hidden = true;
      videoCard.innerHTML = [
        '<div><strong>Видео</strong></div>',
        '<div>ID: ' + escapeHtml(videoItem.video_id || "") + '</div>',
        '<button class="btn delete-block-item-btn" data-item-id="' + videoItem.id + '" type="button">Удалить</button>'
      ].join("");
      return;
    }

    addVideoToggleBtn.hidden = false;
    videoCard.innerHTML = '<div class="admin-empty">Видео не добавлено</div>';
  }

  function renderFilesSection() {
    var files = loadFiles();
    var filesList = document.getElementById("filesList");

    if (!filesList) return;

    if (!files.length) {
      filesList.innerHTML = '<div class="admin-empty">Файлы не добавлены</div>';
      return;
    }

    filesList.innerHTML = files.map(function (file) {
      return [
        '<div class="admin-block-item-row">',
        '<span>' + escapeHtml(file.file_label || "Без названия") + '</span>',
        '<button class="btn delete-block-item-btn" data-item-id="' + file.id + '" type="button">Удалить</button>',
        '</div>'
      ].join("");
    }).join("");
  }

  async function openBlockInRichEditor(blockId) {
    var block = state.blocks.find(function (item) {
      return String(item.id) === String(blockId);
    });

    if (!block) return;
    if (block.block_type !== "html") return;

    initQuillEditor();
    if (!state.quill) return;

    var richEditorWrap = document.getElementById("richEditorWrap");
    if (richEditorWrap) {
      richEditorWrap.hidden = false;
    }

    state.selectedBlockId = block.id;
    state.blockItems = await fetchBlockItems(block.id);

    await loadTextItem();

    var videoInput = document.getElementById("videoIdInput");
    if (videoInput) {
      videoInput.value = "";
    }

    renderContentSections();
  }

  async function selectLessonById(lessonDbId) {
    var lesson = state.lessons.find(function (item) {
      return String(item.id) === String(lessonDbId);
    });

    if (!lesson) return;

    state.selectedLesson = lesson;
    state.blocks = await fetchLessonBlocks(lesson.id);
    state.selectedBlockId = null;
    state.blockItems = [];

    var richEditorWrap = document.getElementById("richEditorWrap");
    if (richEditorWrap) {
      richEditorWrap.hidden = true;
    }

    renderLessonsList();
    renderEditor();
  }

  async function createBlock() {
    if (!state.selectedLesson) return;

    var client = getClient();
    if (!client) return;

    var nextOrder = 1;

    if (state.blocks.length) {
      nextOrder = Math.max.apply(null, state.blocks.map(function (b) {
        return b.sort_order || 0;
      })) + 1;
    }

    var result = await client
      .from("lesson_blocks")
      .insert({
        lesson_id: state.selectedLesson.id,
        sort_order: nextOrder,
        block_type: "html",
        content_html: `<div class="lesson-block">
<h3>Новый блок</h3>
<p>Напишите текст...</p>
</div>`
      })
      .select();

    if (result.error) {
      console.error(result.error);
      alert("Ошибка создания блока");
      return;
    }

    state.blocks.push(result.data[0]);
    renderBlocksList();
  }

  async function saveBlock(blockId) {
    var client = getClient();
    if (!client) return;

    var textarea = document.querySelector('.admin-block-editor[data-block-id="' + blockId + '"]');
    if (!textarea) return;

    var newHtml = textarea.value;

    var result = await client
      .from("lesson_blocks")
      .update({ content_html: newHtml })
      .eq("id", blockId)
      .select();

    if (result.error) {
      console.error(result.error);
      alert("Ошибка сохранения блока");
      return;
    }

    var updated = result.data && result.data[0];
    if (!updated) return;

    state.blocks = state.blocks.map(function (block) {
      return String(block.id) === String(blockId) ? updated : block;
    });

    alert("Блок сохранён");
  }

  function bindEvents() {
    document.getElementById("lessonsList").addEventListener("click", function (event) {
      var button = event.target.closest("[data-lesson-db-id]");
      if (!button) return;

      var lessonDbId = button.getAttribute("data-lesson-db-id");
      void selectLessonById(lessonDbId);
    });

    document.getElementById("addBlockBtn").addEventListener("click", function () {
      void createBlock();
    });

    document.getElementById("saveRichBlockBtn").addEventListener("click", function () {
      void saveTextItem();
    });

    document.getElementById("addVideoToggleBtn").addEventListener("click", function () {
      var videoForm = document.getElementById("videoForm");
      if (!videoForm) return;
      videoForm.hidden = !videoForm.hidden;
    });

    document.getElementById("saveVideoBtn").addEventListener("click", async function () {
      var videoInput = document.getElementById("videoIdInput");
      if (!videoInput) return;

      var videoId = videoInput.value.trim();
      if (!videoId) {
        alert("Введите Video ID");
        return;
      }

      await createVideoItem(videoId);
      videoInput.value = "";

      var videoForm = document.getElementById("videoForm");
      if (videoForm) {
        videoForm.hidden = true;
      }

      renderVideoSection();
    });

    document.getElementById("addFileToggleBtn").addEventListener("click", function () {
      var fileForm = document.getElementById("fileForm");
      if (!fileForm) return;
      fileForm.hidden = !fileForm.hidden;
    });

    document.getElementById("saveFileBtn").addEventListener("click", async function () {
      var fileLabelInput = document.getElementById("fileLabelInput");
      var fileIdInput = document.getElementById("fileIdInput");
      if (!fileLabelInput || !fileIdInput) return;

      var fileLabel = fileLabelInput.value.trim();
      var fileId = fileIdInput.value.trim();

      if (!fileLabel || !fileId) {
        alert("Заполните название файла и file_id");
        return;
      }

      await createFileItem(fileLabel, fileId);
      fileLabelInput.value = "";
      fileIdInput.value = "";

      var fileForm = document.getElementById("fileForm");
      if (fileForm) {
        fileForm.hidden = true;
      }

      renderFilesSection();
    });

    document.getElementById("richEditorWrap").addEventListener("click", function (event) {
      var deleteBtn = event.target.closest(".delete-block-item-btn");
      if (!deleteBtn) return;

      var itemId = deleteBtn.getAttribute("data-item-id");
      if (!itemId) return;
      void deleteItem(itemId);
    });

    document.getElementById("blocksList").addEventListener("click", function (event) {
      var button = event.target.closest(".save-block-btn");
      if (!button) return;

      var blockId = button.getAttribute("data-block-id");
      void saveBlock(blockId);
    });

    document.getElementById("blocksList").addEventListener("click", function (event) {
      if (event.target.closest(".admin-block-editor")) return;
      if (event.target.closest(".save-block-btn")) return;

      var block = event.target.closest(".admin-block-item");
      if (!block) return;

      var blockId = block.getAttribute("data-block-id");
      void openBlockInRichEditor(blockId);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function init() {
    document.getElementById("adminCourseLabel").textContent = getConfig().courseId || "Без courseId";

    bindEvents();

    state.lessons = await fetchLessons();
    renderLessonsList();

    if (state.lessons.length) {
      await selectLessonById(state.lessons[0].id);
    }
  }

  init().catch(function (error) {
    console.error(error);
    var empty = document.getElementById("editorEmpty");
    empty.hidden = false;
    empty.textContent = error.message || "Ошибка загрузки админки";
  });
})();
