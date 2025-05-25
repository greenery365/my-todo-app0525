class TodoApp {
    constructor() {
        this.todos = JSON.parse(localStorage.getItem('todos')) || [];
        this.currentFilter = 'all';
        this.initializeElements();
        this.bindEvents();
        this.render();
    }

    initializeElements() {
        this.todoInput = document.getElementById('todoInput');
        this.addBtn = document.getElementById('addBtn');
        this.todoList = document.getElementById('todoList');
        this.todoCount = document.getElementById('todoCount');
        this.filterBtns = document.querySelectorAll('.filter-btn');
    }

    bindEvents() {
        this.addBtn.addEventListener('click', () => this.addTodo());
        this.todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodo();
        });
        
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });
    }

    addTodo() {
        const text = this.todoInput.value.trim();
        if (!text) return;

        const todo = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date()
        };

        this.todos.push(todo);
        this.todoInput.value = '';
        this.saveTodos();
        this.render();
    }

    deleteTodo(id) {
        this.todos = this.todos.filter(todo => todo.id !== id);
        this.saveTodos();
        this.render();
    }

    toggleTodo(id) {
        const todo = this.todos.find(todo => todo.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            this.saveTodos();
            this.render();
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;
        this.filterBtns.forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        this.render();
    }

    getFilteredTodos() {
        switch (this.currentFilter) {
            case 'active':
                return this.todos.filter(todo => !todo.completed);
            case 'completed':
                return this.todos.filter(todo => todo.completed);
            default:
                return this.todos;
        }
    }

    createTodoElement(todo) {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        
        li.innerHTML = `
            <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
            <span class="todo-text">${this.escapeHtml(todo.text)}</span>
            <button class="delete-btn">削除</button>
        `;

        const checkbox = li.querySelector('.todo-checkbox');
        const deleteBtn = li.querySelector('.delete-btn');

        checkbox.addEventListener('change', () => this.toggleTodo(todo.id));
        deleteBtn.addEventListener('click', () => this.deleteTodo(todo.id));

        return li;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    render() {
        const filteredTodos = this.getFilteredTodos();
        
        this.todoList.innerHTML = '';
        filteredTodos.forEach(todo => {
            this.todoList.appendChild(this.createTodoElement(todo));
        });

        this.updateStats();
    }

    updateStats() {
        const activeTodos = this.todos.filter(todo => !todo.completed).length;
        this.todoCount.textContent = activeTodos;
    }

    saveTodos() {
        localStorage.setItem('todos', JSON.stringify(this.todos));
    }

    async processIssues(issueNumbers) {
        const tasks = issueNumbers.map(issueNumber => this.processIssue(issueNumber));
        await Promise.all(tasks);
        this.saveTodos();
        this.render();
    }

    async processIssue(issueNumber) {
        const todo = {
            id: Date.now() + Math.random(),
            text: `Issue #${issueNumber} の処理`,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.todos.unshift(todo);
        // 処理のシミュレーション
        await new Promise(resolve => setTimeout(resolve, 1000));
        todo.completed = true;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new TodoApp();
    app.processIssues([1, 2, 3]);
});