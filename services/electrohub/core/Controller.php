<?php
    require_once __DIR__ . '/../vendor/autoload.php';
    require_once __DIR__ . '/Utils.php';
    require_once __DIR__ . '/Session.php';

    class Controller
    {
        public $template;
        protected $option;

        function __construct($option = [])
        {
            $this->option = $option;
        }

        function get_context():array
        {
            return array();
        }

        function render(array $context = []):string
        {
            $loader = new Twig_Loader_Filesystem(__DIR__ . '/../template/');
            $twig = new Twig_Environment($loader);
            $context['is_auth'] = Session::is_authenticated();
            return $twig->render($this->template, $context);
        }

        public function get()
        {
            error(404);
        }

        public function post()
        {
            error(404);
        }
    }