import React, { useState } from 'react';

function HelloReact() {
    const [count, setCount] = useState(0);
    const [name, setName] = useState('World');

    return (
        <div>
            <h1>Hello, {name}!</h1>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>
                Click me
            </button>
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
            />
        </div>
    );
}

export default HelloReact;