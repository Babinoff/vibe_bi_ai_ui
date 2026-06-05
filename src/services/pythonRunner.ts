declare global {
  interface Window {
    loadPyodide: any;
  }
}

let pyodideInstance: any = null;

export class PythonRunner {
  static async init(onLog?: (msg: string) => void) {
    if (!pyodideInstance) {
      if (!window.loadPyodide) {
        onLog?.('Injecting Pyodide script...');
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Pyodide script'));
          document.head.appendChild(script);
        });
      }
      
      onLog?.('Downloading and initializing Python runtime (Pyodide)... This may take a moment.');
      pyodideInstance = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
      });
      
      onLog?.('Loading pandas library...');
      await pyodideInstance.loadPackage('pandas');
      onLog?.('Python runtime ready.');
    }
    return pyodideInstance;
  }

  static async run(code: string, headers: string[], data: any[][], onLog?: (msg: string) => void) {
    const pyodide = await this.init(onLog);
    
    onLog?.('Preparing data for Python...');
    // Convert data to JSON string to pass to Python
    const inputJson = JSON.stringify(data.map(row => {
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    }));

    // Set up the Python environment
    pyodide.globals.set('input_json', inputJson);
    
    const wrapperCode = `
import pandas as pd
import json
import sys
import io
import traceback

def run_user_code():
    data_dicts = json.loads(input_json)
    df = pd.DataFrame(data_dicts)
    
    # Create globals for user code
    user_globals = {'pd': pd, 'df': df}
    
    # Safely pass the user code
    import builtins
    user_globals['__builtins__'] = builtins
    
    # Redirect stdout to capture prints
    old_stdout = sys.stdout
    redirected_output = sys.stdout = io.StringIO()
    
    try:
        user_code = ${JSON.stringify(code)}
        exec(user_code, user_globals)
        
        output_df = user_globals.get('result_df', user_globals['df'])
        printed_text = redirected_output.getvalue()
        
        result_json = output_df.to_json(orient='split', date_format='iso')
        
        return json.dumps({
            "success": True,
            "df_json": result_json,
            "printed_text": printed_text
        })
    except Exception as e:
        error_msg = traceback.format_exc()
        printed_text = redirected_output.getvalue()
        return json.dumps({
            "success": False,
            "error": error_msg,
            "printed_text": printed_text
        })
    finally:
        sys.stdout = old_stdout

result_json_str = run_user_code()
result_json_str
`;

    onLog?.('Executing Python code...');
    try {
      const combinedJsonStr = await pyodide.runPythonAsync(wrapperCode);
      onLog?.('Execution complete. Parsing results...');
      
      const combinedObj = JSON.parse(combinedJsonStr);
      
      if (!combinedObj.success) {
        if (combinedObj.printed_text) {
          onLog?.('Output before error:\\n' + combinedObj.printed_text);
        }
        throw new Error(combinedObj.error || 'Unknown Python error');
      }
      
      const resultObj = JSON.parse(combinedObj.df_json);
      
      if (combinedObj.printed_text) {
        onLog?.('Output from Python print():\\n' + combinedObj.printed_text);
      }
      
      return {
        headers: resultObj.columns,
        data: resultObj.data,
        printed_text: combinedObj.printed_text
      };
    } catch (error: any) {
      console.error('Python execution error:', error);
      throw new Error(error.message || 'Python execution failed');
    }
  }
}
